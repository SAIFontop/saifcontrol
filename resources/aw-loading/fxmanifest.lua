fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'aw-loading'
description 'AIRWAR Loading Screen'
author 'AIRWAR'
version '1.0.0'
loadscreen 'html/index.html'
loadscreen_cursor 'yes'
loadscreen_manual_shutdown 'yes'

files {
    'html/index.html',
    'html/assets/**/*',
    'html/config.json',
    'html/*.mp3',
    'html/*.mp4',
    'html/*.webm',
    'html/*.ogg',
    'html/*.jpg',
    'html/*.png',
    'html/*.jpeg',
    'html/*.webp',
    'html/*.gif',
}

client_script 'client.lua'
