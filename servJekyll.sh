#/bin/bash 
set -x
echo "Using MINGW64 `which -a bundle`"
bundle exec jekyll serve  --host 0.0.0.0 #--livereload
#bundle exec jekyll serve  --incremental
