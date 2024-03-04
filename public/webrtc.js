var localVideo;
var firstPerson = false;
var socketCount = 0;
var socketId;
var localStream;
var connections = [];
const chat = document.getElementById("chat");
chat.hidden = true;

const HOST_URL = "ws://localhost:8003";

var peerConnectionConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

let socket;
const roomName = window.location.pathname.split("/")[2];
let myname = "";

let defaultConfigObj = {};

window.onload = () => {
  $(document).ready(function () {
    let searchStr = window.location.search.substring("1");
    if (searchStr) {
      searchStr.split("&").forEach((item) => {
        const [name, value] = item.split("=");
        defaultConfigObj[name] = decodeURIComponent(value);
      });
      myname = defaultConfigObj.name;
    }

    if (defaultConfigObj.visitNotesEnabled) {
      let visitNotesDiv = document.getElementsByClassName("visitNotes");
      visitNotesDiv[1].classList.add("main_controls_button");
      visitNotesDiv[1].innerHTML +=
        "<button type='button' class='btn btn-primary' onClick='visitNotesClick()'><span>Visit Notes</span></button>";
      visitNotesDiv[0].innerHTML +=
        "<button type='button' class='dropdown-item' onClick='visitNotesClick()'><i class='fas fa-notes-medical'></i><span>Visit Notes</span></button>";
    }

    pageReady();
  });
};

function pageReady() {
  localVideo = document.getElementById("localVideo");

  var constraints = {
    video: {
      width: { min: 320, ideal: 1280, max: 1280 },
      height: { min: 180, ideal: 720, max: 720 },
    },
    audio: true,
  };

  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(getUserMediaSuccess)
      .then(function () {
        socket = io(HOST_URL);
        socket.on("signal", gotMessageFromServer);

        socket.emit("join-room", roomName, myname);

        socket.on("connect", function () {
          socketId = socket.id;

          socket.on("user-left", function (id) {
            var video = document.querySelector('[data-socket="' + id + '"]');
            var parentDiv = video.parentElement;
            video.parentElement.parentElement.removeChild(parentDiv);
          });

          socket.on("user-joined", function (id, count, clients) {
            clients.forEach(function (socketListId) {
              if (!connections[socketListId]) {
                connections[socketListId] = new RTCPeerConnection(
                  peerConnectionConfig
                );
                //Wait for their ice candidate
                connections[socketListId].onicecandidate = function () {
                  if (event.candidate != null) {
                    console.log("SENDING ICE");
                    socket.emit(
                      "signal",
                      socketListId,
                      JSON.stringify({ ice: event.candidate })
                    );
                  }
                };

                //Wait for their video stream
                connections[socketListId].onaddstream = function () {
                  gotRemoteStream(event, socketListId);
                };

                //Add the local video stream
                connections[socketListId].addStream(localStream);
              }
            });

            //Create an offer to connect with your local description

            if (count >= 2) {
              connections[id].createOffer().then(function (description) {
                connections[id]
                  .setLocalDescription(description)
                  .then(function () {
                    // console.log(connections);
                    socket.emit(
                      "signal",
                      id,
                      JSON.stringify({ sdp: connections[id].localDescription })
                    );
                  })
                  .catch((e) => console.log(e));
              });
            }
          });
        });
      });
  } else {
    // alert("Your browser does not support getUserMedia API");
  }
}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
}

function gotRemoteStream(event, id) {
  var video = document.createElement("video"),
    div = document.createElement("div");

  video.setAttribute("data-socket", id);
  video.srcObject = event.stream;
  video.autoplay = true;
  video.muted = true;
  video.playsinline = true;

  div.appendChild(video);

  const videoGrids = document.getElementById("video-grids");
  videoGrids.appendChild(div);
}

function gotMessageFromServer(fromId, message) {
  //Parse the incoming signal
  var signal = JSON.parse(message);

  //Make sure it's not coming from yourself
  if (fromId != socketId) {
    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(function () {
          if (signal.sdp.type == "offer") {
            connections[fromId]
              .createAnswer()
              .then(function (description) {
                connections[fromId]
                  .setLocalDescription(description)
                  .then(function () {
                    socket.emit(
                      "signal",
                      fromId,
                      JSON.stringify({
                        sdp: connections[fromId].localDescription,
                      })
                    );
                  })
                  .catch((e) => console.log(e));
              })
              .catch((e) => console.log(e));
          }
        })
        .catch((e) => console.log(e));
    }

    if (signal.ice) {
      connections[fromId]
        .addIceCandidate(new RTCIceCandidate(signal.ice))
        .catch((e) => console.log(e));
    }
  }
}

const muteUnmute = () => {
  const enabled = localStream.getAudioTracks()[0].enabled;
  var element = document.getElementById("mute-icon");
  var muteText = document.getElementById("muteText");
  if (enabled) {
    localStream.getAudioTracks()[0].enabled = false;
    element.classList.add("fa-microphone-slash");
    element.classList.remove("fa-microphone");
    muteText.innerHTML = "Unmute";
  } else {
    localStream.getAudioTracks()[0].enabled = true;
    element.classList.add("fa-microphone");
    element.classList.remove("fa-microphone-slash");
    muteText.innerHTML = "Mute";
  }
};

const VideomuteUnmute = () => {
  const enabled = localStream.getVideoTracks()[0].enabled;
  var element = document.getElementById("video-icon");
  var videoText = document.getElementById("videoText");
  if (enabled) {
    localStream.getVideoTracks()[0].enabled = false;
    element.classList.add("fa-video-slash");
    element.classList.remove("fa-video");
    videoText.innerHTML = "Start Video";
  } else {
    localStream.getVideoTracks()[0].enabled = true;
    element.classList.add("fa-video");
    element.classList.remove("fa-video-slash");
    videoText.innerHTML = "Stop Video";
  }
};

const showchat = () => {
  if (chat.hidden == false) {
    chat.hidden = true;
  } else {
    chat.hidden = false;
  }
};
