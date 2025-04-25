#!/usr/bin/env python
# Author: Xiaowei Song  (dawnwei.Song@gmail.com)
# Version: 20250415

from typing import Iterator, Tuple
from seleniumbase import Driver, SB  # should choose SB over Driver !!! 20240109
import re
import sys
import os
import subprocess
import tempfile
import requests
import shutil
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timedelta
from dateutil import parser
# import numba 

# ----------------------------------------------------
# configure log for cmd line
with Path(f'{__file__}.LOG').open("a") as LOG:
    cmd = " ".join(f"'{i}'" if " " in i else i for i in sys.argv)
    LOG.write(datetime.now().strftime("%Y%m%d.%H%M%S: ") + cmd + "\n")
# ----------------------------------------------------

import pandas as pd
# import pyap #parse cleaned addresses from string/text

# ----------------------------------------------------
# make sure msedgedriver.exe is in the path such that I can automate MS Edge
# import sys
# # sys.path.append('C:\bit9prog\dev\MSEdgeDriver')
# sys.path
# print(os.environ['PATH'].replace(";", "\n"))
# ----------------------------------------------------

import numpy as np
from tqdm import tqdm
import math
import joblib
from random import randint, random
import time  # use its sleep
import string
import json
from requests import head, options

from configobj import ConfigObj

# 0-----------------------------
# initialize selenium4
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options as EdgeOptions

# import chatPDF #20230818, use chatPDF.com API to extract receipts info
import traceback
import logging
logging.basicConfig(level=logging.DEBUG,
                    format='%(asctime)s - %(name)s - %(lineno)s - %(levelname)s - %(message)s')
logger = logging.getLogger()
fhandler = logging.FileHandler(
    filename=f'{Path(__file__).stem}__logging.log', mode='w')
logger.addHandler(fhandler)
logger.info('-'*16 + datetime.now().strftime("%Y%m%d.%H%M%S") + '-'*16)


# ----------------------------------------------------------------------------
# import configparser
# (default_config_files=['config.ini', '.config.ini'])
config = ConfigObj('config.ini')
# def parseArgs(fini='config.ini'):
#   global config
#   config._load(fini)
#   return config

OVERWRITE = 0  # config['default']['Overwrite'] #0 by default
# ----------------------------------------------------------------------------

# from driveChrome import browser ,browser2
# # from driveEdge import browser ,browser2
# driver=browser
# tmpDriver=browser2
driver = None
sb = None
# chrome window handles are class string
win0 = ''
win1 = ''


def rsleep(maxSeconds=180, minSeconds=1):
    rsec = randint(minSeconds, maxSeconds)
    print(f"random sleep {rsec} seconds")
    time.sleep(rsec)


# https://stackoverflow.com/questions/72938098/list-of-entries-files-and-folders-in-a-directory-tree-by-os-scandir-in-pytho


def dir2list(dir: str) -> Iterator[Tuple[str, str, str]]:
    import os
    for i in os.scandir(dir):
        if i.is_dir():
            yield ["dir", i.name, i.path]
            yield from dir2list(i.path)
        else:
            yield ["file", i.name, i.path]
# ----------------------------------------------------------------------------


def isMusicSongFile(fp) -> Tuple[bool, str]:
    import magic
    mgc = magic.from_file(fp)
    logger.info(f"file {fp} magic: {mgc}")
    for st in ['audio', 'mp4', 'mpeg adts']:
        if st in str.lower(mgc):
            return True, mgc
    return False, mgc

def summary4favdb(favdb):
    ul=[u for u in favdb if 'url:'==u[:4]]
    logger.info(f'len(url:)={len(ul)}')
    
    fl=[f for f in favdb if 'file:'==f[:5]]    
    logger.info(f'len(file:)={len(fl)}')
    

def updateLocalFav(ld='./local', favdb={}):
    # from pathlib import Path
    import os
    from urllib.parse import quote, unquote
    from googleSignedUrl4bucket import mkGoogleSignedUrl4download
    gurl = f"https://storage.googleapis.com/xmusic/{Path(ld).stem}/"
    # for f in os.scandir(ld):
    for ft, fn, fp in dir2list(ld):
        if ft == 'dir':
            continue
        isMusicSong, mgc = isMusicSongFile(fp)
        if isMusicSong:
            # adding 2 essential keys
            # assume I have uploaded all local files to Google Storage, i.e., I don't waste time to check again
            # favdb[f'url:{Path(fn).stem}'] = quote(gurl+fn, safe=':/')
            # favdb[f'pic:{Path(fn).stem}'] = quote(gurl+Path(fn).with_suffix('.jpg').name, safe=':/')
            urlk=f'url:{Path(fn).stem}'
            fk=f'file:{Path(fn).stem}'
            if urlk in favdb and not isSignedUrlExpired(favdb[urlk]):
                logger.info(f'Already indexed and not expired yet, {urlk}')
            else:
                favdb[fk]=Path(fn).name
                favdb[urlk] = mkGoogleSignedUrl4download(f"{Path(ld).stem}/{fn}", bucket_name='xmusic')
                pic=f'pic:{Path(fn).stem}'
                if pic not in favdb: #todo, deal with pic not existing in gcloud, 20250425
                    favdb[pic] = mkGoogleSignedUrl4download(f"{Path(ld).stem}/{Path(fn).with_suffix('.jpg').name}", bucket_name='xmusic')
        else:
            logger.warning(f"Ignore {fp} since it is not audio BUT {mgc}")
    return favdb


def fn2googleStorageURL(fn, qURL):
    from urllib.parse import quote, unquote        
    from googleSignedUrl4bucket import mkGoogleSignedUrl4download
    gurl = f"https://storage.googleapis.com/xmusic/q/{fn}"

    q = quote(gurl, safe=':/')
    q = mkGoogleSignedUrl4download(f"q/{fn}", bucket_name='xmusic')
    logger.info(f"Trying {fn} -> {gurl} | {q}")
    h = requests.head(q)
    logger.info(
        f"{fn} size: {int(h.headers['Content-Length']) / 1024./1024:.1f} MB,type: {h.headers['Content-Type']}")
    if h.status_code == 200 and 'audio' in h.headers['Content-Type'].lower():
        logger.info(f"Found audio {fn} in {gurl}")
        return q, True
    else:
        logger.info(
            f"NO audio {fn} in Google Storage yet: {h.status_code}/{h.headers['Content-Type']}, use original music URL {qURL} instead")
    return qURL, False


def isSignedUrlExpired(url):
  from urllib.parse import urlparse, parse_qs
  parsed_url = urlparse(url)
  query_params = parse_qs(parsed_url.query) 
  expired=True
  try: #in case old URLs does not have google cache/xgcloud keys
    signDate=query_params['X-Goog-Date'][0]
    signExpiration=query_params['X-Goog-Expires'][0]
    from datetime import datetime, timedelta ,timezone
    signExpirationDate=datetime.strptime(signDate, "%Y%m%dT%H%M%SZ")+ timedelta(seconds=float(signExpiration), hours=-5) #embed -5 timezone info into the delta
    if signExpirationDate>=datetime.now():  #toCheck: .replace(tzinfo=timezone.utc) not work yet
        logger.info(f"signExpirationDate {signExpirationDate}-5 >= {datetime.now()} not expired yet.")
        expired=False 
    else: 
        logger.warning(f"signExpirationDate {signExpirationDate}-5 | {url} < {datetime.now()} , already expired!!!")        
  except Exception as e:
    logger.exception(f'{e}')
    traceback.print_exc()
  return expired

def rmTroubleChar(name, troubleCharSet=[':', '(', ')', '/', '\\', ' ', "'", '"', '[', ']', '?'], replace2c='-'):
  fn=name
  for p in troubleCharSet:  fn = fn.replace(p, replace2c)
  return fn

def rmTroubleChar0(name, allowedCharSet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-', replace2c=''):  
  regex = f'[^{re.escape(allowedCharSet)}]'
  return re.sub(regex, replace2c, name)
  

def exportFav(favdb):
    with open(f"songs.txt", 'w') as f:
        f.write("")
    # for k in tqdm([ku for ku in favdb.keys() if re.match(r'url:', ku)]):
    for k in tqdm([ku for ku in favdb.keys() if 'url:'==ku[:4]]):
        logger.info(f"exporting {k}: {favdb[k]}")
        kk = k.replace('url:', '')
        artist = re.sub('__.*', '', kk)
        name = re.sub('.*__', '', kk)
        # -------------------------------------------------
        artist=rmTroubleChar(artist)
        name  =rmTroubleChar(name)
        # -------------------------------------------------
        fk = f'file:{artist}__{name}'
        gk = f'isGoogleStored:{artist}__{name}'
        gURL = f'GoogleStoredURL:{artist}__{name}'
        url = favdb[k]
        if fk in favdb:
            # only check if I have not checked with my google storage
            if ('404' not in favdb[fk]): #ignore mp3/m4a filename having 404
                if not (gk in favdb and favdb[gk] and not isSignedUrlExpired(favdb[gURL])):
                    url, favdb[gk] = fn2googleStorageURL(favdb[fk], favdb[k])
                    logger.debug(f"{gk} = {favdb[gk]}")
                    # rsleep(3)
                    if favdb[gk]:
                        favdb[gURL] = url
            else: logger.info(f"404 song files are ignored: {favdb[fk]}")
            if gk in favdb and favdb[gk]:
                url = favdb[gURL]
                logger.info(f"use Google Storage url: {url}")
        else:
            logger.warning(f"{fk} not found in favdb")
        logger.info(f"Use cached URL: {url}")
        # -------------------------------------------------
        cover = favdb[f'pic:{kk}']
        with open(f"songs.txt", 'a') as f:
            f.write(f"""{{
name: '{name}' ,
artist: '{artist}' ,
url: '{url}' ,
cover: '{cover}'  ,
}},""")
    # replace my template with the song lists
    # with open('../_includes/footer/custom.html.aplayerTemplate.html', 'r') as tpl:
    with open('xplayer.playlist.js', 'r') as tpl:
        with open('songs.txt', 'r') as songs:
            # with open('../_includes/footer/custom.html', 'w') as ft:
            with open('playlist.js', 'w') as ft:
                for line in tpl:
                    if '//%musicDictList' in line:
                        for sl in songs:
                            ft.write(sl)
                    else:
                        ft.write(line)

# ----------------------------------------------------------------------------


def hifiniHeaders(rURL, bytesEnd=''):
    ck = sb.driver.get_cookies()
    bbsIDToken = ''
    for i in range(len(ck)):
        bbsIDToken = f'{bbsIDToken} {ck[i]["name"]}={ck[i]["value"]};'

    hifiniHeaders = {"accept": "*/*",
                     "priority": "i",
                     "range": f"bytes=0-{bytesEnd}",
                     'dnt': '1',
                     'referer': rURL,
                     'cookie': bbsIDToken.strip(),
                     'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                     'sec-ch-ua': '"Chromium";v="135", "Google Chrome";v="135", "Not?A_Brand";v="8"',
                     "sec-ch-ua-mobile": "?0",
                     'sec-ch-ua-platform': 'Linux',
                     "sec-fetch-dest": "audio",
                     "sec-fetch-mode": "no-cors",
                     "sec-fetch-site": "same-origin",
                     # "referrer-policy": "strict-origin-when-cross-origin",
                     'user-agent': 'xChrome/135',
                     }
    logger.info(hifiniHeaders)
    return hifiniHeaders


def requestsHeader(mURL, rURL):
    # if '.hifini.com' in mURL:
    return requests.head(mURL, allow_redirects=True, stream=False, headers=hifiniHeaders(rURL, bytesEnd='0'))
    # else:
    #   return requests.head(mURL, allow_redirects=True, stream=False)


def requestsGet(mURL, rURL):
    # if '.hifini.com' in mURL:
    # use stream to download hifini music
    return requests.get(mURL, allow_redirects=True, stream=True, headers=hifiniHeaders(rURL))
    # else:
    #   return requests.get(mURL, allow_redirects=True, stream=True) #stream=True since we want to save raw data to m4a file, stream=False also worked for qqMusic


def getDownLoadedFileName(waitTime=120):
    # method to get the downloaded file name
    # https://stackoverflow.com/questions/34548041/selenium-give-file-name-when-downloading
    driver = sb.driver
    driver.execute_script("window.open()")
    # switch to new tab
    driver.switch_to.window(driver.window_handles[-1])
    # navigate to chrome downloads
    driver.get('chrome://downloads')
    # define the endTime
    endTime = time.time()+waitTime
    while True:
        try:
            # get downloaded percentage
            downloadPercentage = driver.execute_script(
                "return document.querySelector('downloads-manager').shadowRoot.querySelector('#downloadsList downloads-item').shadowRoot.querySelector('#progress').value")
            # check if downloadPercentage is 100 (otherwise the script will keep waiting)
            if downloadPercentage == 100:
                # return the file name once the download is completed
                return driver.execute_script("return document.querySelector('downloads-manager').shadowRoot.querySelector('#downloadsList downloads-item').shadowRoot.querySelector('div#content  #file-link').text")
        except:
            pass
        time.sleep(1)
        if time.time() > endTime:
            break


def guessSongFilename(qUrl, author='', title='', dir4songs='songs/'):
    # save mp3 to local
    # in case there is / included in the params after ?
    ufn = qUrl.split('?')[0]
    ufn = ufn.split('/')[-1]
    ufn = ufn.split('?')[0]
    try:
        ext = ufn.split('.')[-1]  # the last part
        if ext.lower() in ('php'):
            ext = 'm4a'
    except Exception as e:
        ext = ''
        logger.error(f"qURL={qUrl} |no extension Error|: {e}")
    fn = f"{author}__{title}.{ext}"
    fn =rmTroubleChar(fn)  # remove all illegal filenames in Windows        
    return "songs/"+fn
  

def getFavSongs(url, favdb={}):
    sbd = sb.driver
    sbd.uc_open_with_tab(url)

    favPage = {}
    sbd.wait_for_element_present("div.subject", timeout=10)
    # counting from 1, not 0!
    songs = sbd.find_elements(By.XPATH, '//div[@class="subject"]/a[2]')
    hrefs = [None]*len(songs)
    # gather all links for this page
    for i in range(len(songs)):
        print(songs[i].text)
        songName = re.sub(r"\[.*", r"", songs[i].text).strip()
        href = songs[i].get_attribute('href')
        favPage[f'hifini:{songName}'] = href
        hrefs[i] = f'hifini:{songName}'
    print(hrefs)
    for i in range(len(hrefs)):
        songName = re.sub(r'hifini:', '', hrefs[i])
        name = re.sub(r'.*《([^》]*)》', r'\1', songName).strip()
        artist = re.sub(
            r'《.*》', '', songName).strip().replace('/', '-').replace('\\', '-')
        # even qq music URL has time limit!
        # logging.info(f"Checking if {artist}__{name} already has QQ URL in favdb")
        # if f'url:{artist}__{name}' in favdb:
        #   logging.info(f"url:{artist}__{name} already exists in favdb: {favdb[f'url:{artist}__{name}']}")
        #   continue
        logger.info(
            f"Checking if {artist}__{name} already has song downloaded")
        fk = f'file:{artist}__{name}'
        # dl=f'downloaded:{artist}__{name}' #make extra link in case the listed artist/song name does not match real song/artist name within the linked detail song page
        if fk in favdb and Path(f'songs/{favdb[fk]}').is_dir():
            favdb.pop(fk, None)
        if fk in favdb and Path(f'songs/{favdb[fk]}').is_file() and Path(f'songs/{favdb[fk]}').exists():
            logger.info(f"{fk} | songs/{favdb[fk]} already downloaded")
            # mark downloaded solving historical flags due to the difference between fav list and real song name/artist in detailed song page
            continue

        logger.info(f"NEW {fk}")

        href = favPage[hrefs[i]]
        sbd.uc_open_with_tab(href)
        # rsleep(3)
        # sbd.wait_for_element_present("div.player4", timeout=20)
        sbd.highlight(By.XPATH, "//div[@id='player4']")
        # sb.activate_jquery()
        # print(sbd.execute_script("return jQuery('ap4.list')"))
        # sbd.execute_script("jQuery('console.log(ap4)')")
        mUrl = sbd.execute_script("return ap4.music.url")
        if 'http' not in mUrl:
            mUrl = f'https://hifini.com/{mUrl}'
        title = sbd.execute_script("return ap4.music.title").strip()
        author = sbd.execute_script("return ap4.music.author").strip().replace(
            '/', '-').replace('\\', '-')
        pic = sbd.execute_script("return ap4.music.pic")
        logger.info(f'{title} - {author} : {mUrl}')
        favPage[f'pic:{author}__{title}'] = pic
        favPage[f'url:{author}__{title}'] = mUrl
        favPage[f'file:{author}__{title}'] = ''
        # get redirected QQ url for the music
        # #this will download the music
        # sbd.uc_open_with_tab(f'https://hifini.com/{mUrl}')
        # rsleep(3)
        # qUrl=sbd.current_url

        # requests.head(mUrl, allow_redirects=True, stream=False) #, headers=hifiniHeaders) #only metadata, not to download
        r = requestsHeader(mUrl, href)
        qUrl = None
        # 401/403 means not logged-in/authorized, but I still want to try if body is possible !
        if r.status_code in {200, 206, 401, 403}:
            logger.info(f"header: {r} , mUrl: {mUrl}")
            qUrl = r.url
            # if '404' in qUrl:
            #   #deal with 404 from music.163.com/404
            #   logging.warning(f'404 found qUrl: {qUrl} , i.e., the 200/206 returned header URL for the song')
            # else:
            # if 1==1:
            favPage[f'url:{author}__{title}'] = qUrl
            fn = guessSongFilename(qUrl, author=author,
                                   title=title, dir4songs='songs/')
            favPage[f'file:{author}__{title}'] = Path(fn).name  # only basename
            if not Path(fn).exists():
                logger.info(f"Downloading song `{fn}` from {qUrl}")
                # , headers=hifiniHeaders) as r:
                with requestsGet(qUrl, href) as r:
                    with open(fn, 'wb') as f:
                        shutil.copyfileobj(r.raw, f)
            else:
                logger.info(
                    f"SONG file {fn} already exists, ignore downloading")
            if Path(fn).exists():
                # update link from fav list to real downloaded music filename
                favdb[fk] = Path(fn).name
                logger.info(
                    f"SONG {fn} exists| {favdb[fk]} is MARKED downloaded")
        else:
            logger.warning(r)
        # logging.info(qUrl)
        logger.info(f'{title} - {author} : {qUrl}')
        rsleep(30, minSeconds=10)
        # break
    return favPage


def getFavList(favdb={}):
    sbd = sb.driver
    # sbd.switch_to.window(win0)
    # desc is putting latter added fav song first, unlike asc
    sbd.uc_open_with_tab('https://hifini.com/my-favorites-1.htm?orderby=desc')
    sbd.wait_for_element_present(".nav.nav-tabs.card-header-tabs",  timeout=30) 
    nfavH = sbd.find_elements(
        By.XPATH, "//ul[@class='nav nav-tabs card-header-tabs']")[0]
    print(nfavH.text)
    nfav = int(re.sub(r".*\(([0-9]*)\)", r"\1", nfavH.text))
    # print(nfav)
    npage = int(np.ceil(nfav/10))
    print(f"npage= {npage}")

    for i in tqdm(range(1, npage+1)):
        # sbd.switch_to_window(win1)
        try:
            psongs = getFavSongs(
                f'https://hifini.com/my-favorites-{i}.htm?orderby=desc', favdb)
            print(psongs)
            favdb.update(psongs)
        except Exception as e:
            logger.error(e)
        # print(favdb)
        rsleep(5)
        # break

    return favdb
# ----------------------------------------------------------------------------


def sign4prize():
    sbd = sb.driver
    sbd.uc_open_with_tab('https://hifini.com/')
    sbd.wait_for_element_present("#sg_sign", timeout=30) #default is CSS selector
    signBtn = sbd.find_element(By.XPATH, '//div[@id="sign"]')
    signPanel = sbd.find_element(By.XPATH, '//span[@id="sg_sign"]')
    print(f"{signBtn.text} | {signPanel.text}")
    # if "已签" != signBtn.text:
    signBtn.click()
    rsleep(minSeconds=30)
    # sbd.uc_open_with_tab('https://hifini.com/')
    sbd.wait_for_element_present("#sg_sign", timeout=30)
    signPanel = sbd.find_element(By.XPATH, '//span[@id="sg_sign"]')
    print(signPanel.text)


# $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
def debugModules():
    for m in set(sys.modules).union(set(globals())):  # & is the intersection
        try:
            print(
                f'Imported module version of "{m}" is: {sys.modules[m].__version__}')
        except Exception as e:
            # logger.exception(e)
            logger.warning(f'Imported module "{m}" does not have __version__')


def getSeliumBase(fini='browser.ini'):
    cfg = ConfigObj(fini)
    chrome = cfg['chrome']
    args = chrome['arguments']
    if 'proxy-server' in args:
        args['chromium-arg'] = f"{args['chromium-arg']} , --proxy-server={args['proxy-server']}"
    # , proxy='5.161.74.235:8215')
    return SB(test=True,  uc_cdp=True, binary_location=chrome['chromePath'], user_data_dir=args['user-data-dir'], incognito=False, chromium_arg=args['chromium-arg'])


def main():
    # debugModules()
    global OVERWRITE, config, sb, driver
    # parseArgs('config.ini')
    for k in config['default']:
        logger.info(f"{k}= {config['default'][k]}")
    OVERWRITE = int(config['default']['Overwrite'])

    tday = datetime.today()
    op = 'fav'  # sign
    if len(sys.argv) > 1:
        op = sys.argv[1]
    fzdb = f'hifini.z'
    if len(sys.argv) > 2:
        fzdb = sys.argv[2]
    favdb = {}
    if Path(fzdb).exists():
        [favdb] = joblib.load(fzdb)

    # starting URL with parameters selected for many sub-types
    # sURL='https://oig.hhs.gov/fraud/enforcement/?type=covid-19&type=criminal-and-civil-actions&type=fraud-self-disclosures&type=grant-and-contractor-fraud-self-disclosures&type=state-enforcement-agencies#results'
    # sURL='https://oig.hhs.gov/fraud/enforcement/?type=covid-19&type=criminal-and-civil-actions'
    sURL = 'https://hifini.com/'
    if 'OVERWRITE' in os.environ:
        OVERWRITE = int(os.environ['OVERWRITE'])  # overwrite global var

    # run-----------------------------
    scraped = 0
    with getSeliumBase(fini='browser.ini') as sb:
        driver = sb.driver
        # create 2 windows, one for news list, another one for content from justice.org
        driver.get(sURL)
        logger.info(
            f'current window: {driver.current_window_handle} and its type: {type(driver.current_window_handle)}')
        # win0=driver.current_window_handle
        # driver.switch_to.new_window('window')
        # win1=driver.current_window_handle
        # driver.switch_to.window(driver.window_handles[1])
        try:
            match op:
                case 'fav':
                    try:
                        favdb = getFavList(favdb)                    
                        # scan, update, and export local fav music song files, assuming I have uploaded to Google storage
                        favdb = updateLocalFav('./local', favdb)
                    finally:
                        joblib.dump([favdb], fzdb)  # save after parsing each NPI
                        exportFav(favdb)
                        
                case 'sign':
                    sign4prize()
                case 'export':
                    exportFav(favdb)
                    
                case 'updateSongs': #scan local songs dir that might contain many songs that were not registered with my local cached favdb
                    favdb = updateLocalFav('./songs', favdb)
                    
                case 'rmGoogleCache':
                    k2rm=[k for k in favdb.keys() if 'isGoogleStored' in k]
                    for k in k2rm: favdb.pop(k)
                    
                case _:
                    logger.info('Unknown operation, fav/sign supported')
                    return
        finally:
            summary4favdb(favdb)
            joblib.dump([favdb], fzdb)# save cached google storaged URLs

if __name__ == "__main__":
    main()
# $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
