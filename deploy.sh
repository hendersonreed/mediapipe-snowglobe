#!/bin/env bash

set -euox pipefail

npm run build
cp -f build/* /home/reed/recurse/hendersonreed.github.io/src/pages/projects/snowglobe-hands/
cd /home/reed/recurse/hendersonreed.github.io/
psg build 
git commit -am "automated deployment of snowglobe-hands"
git push
