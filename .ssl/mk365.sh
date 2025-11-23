#!/bin/bash -x
#https://claytonerrington.com/blog/securing-jekyll-with-ssl-locally/
openssl req -x509 -out xmen.crt -keyout xmen.key -newkey rsa:2048 -nodes -sha256 -subj '/CN=xmen' -extensions EXT -config <( \
   printf "[dn]\nCN=xmen\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth") -days 365
