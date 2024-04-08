# WebRTC Multi-Peer Video & Audio

This library creates a traditional multi-peer communication using a single signaling server.  Videos are added to the screen as users join and accept use of their cameras and microphones.  As users disconnect, their videos are removed from all sessions.

![Demo](readme-attachments/demo.gif)

## 1. Setup The Signaling Server
The signaling server can be created and run with nodejs.  Realtime communication is achieved using socket.io
1. Copy the server folder onto your server
2. By default, the server will run on port `8003` 
3. `npm install`
4. `node server.js`
5. Open localhost:8003 or whichever port you have specified.

## Browser Support
This codebase has been tested in the following browsers:
- Chrome
- Safari 11 - Mobile

## Demo URL 
=>  https://webrtc-mulipeer-native.onrender.com/

## Known Issues/Notes
- Safari 10 mobile does not support WEBrtc
- Safari 10 desktop has an issue displaying video - In progress
- Firefox has an issue displaying remote video - In progress
