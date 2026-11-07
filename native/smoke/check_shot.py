#!/usr/bin/env python3
"""Looks at an emulator screenshot of the app: just under the status bar the app's own header should be there
(light), not an Android title bar (the launch theme's, navy with the app name). Usage: check_shot.py shot.png"""
import sys

from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
y0, y1 = int(h * 0.062), int(h * 0.10)
dark = total = 0
for y in range(y0, y1, 4):
    for x in range(0, w, 12):
        r, g, b = im.getpixel((x, y))
        total += 1
        if r + g + b < 360:
            dark += 1
share = dark / max(total, 1)
print('rows %d to %d: %.0f%% dark pixels' % (y0, y1, share * 100))
if share > 0.5:
    sys.exit('a dark band sits where the app header should be: the Android title bar from the launch theme is showing')
