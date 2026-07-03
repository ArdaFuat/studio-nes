#!/usr/bin/env bash
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=390,844 --screenshot=/mnt/data/current_mobile.png file:///mnt/data/studio_nes_fix2/index.html >/tmp/chromelog 2>&1
