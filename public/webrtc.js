var localVideo;
var socketId;
var localStream;
var connections = [];
let screenStream;
let screenSharing = false;
let socket;
let myname = "";
const chat = document.getElementById("chat");
chat.hidden = true;

const HOST_URL = window.location.host;

var peerConnectionConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const roomName = window.location.pathname.split("/")[2];

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

const alertDiv = (msg) => {
  const divElem = document.getElementById("alertDiv");

  const newDiv = document.createElement("div");
  newDiv.innerHTML = `<div class="alert alert-secondary alert-dismissible fade show alertBox" role="alert">${msg} <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>`;
  divElem.prepend(newDiv);

  $(".alert").alert();
};

const socketHandler = () => {
  socket = io(HOST_URL);
  socket.on("signal", gotMessageFromServer);

  sendPostMessageToParent({ eventType: "userconnect" });
  socket.emit("join-room", roomName, myname);

  socket.on("connect", () => {
    socketId = socket.id;
  });

  socket.on("user-left", (id, username) => {
    var video = document.querySelector('[data-socket="' + id + '"]');
    if (video && video.parentElement) {
      var parentDiv = video.parentElement;
      video.parentElement.parentElement.removeChild(parentDiv);
    }

    alertDiv(`${username} left the meeting`);
  });

  socket.on("user-joined", (id, clients, username) => {
    if (id !== socketId) {
      alertDiv(`${username} joined the meeting`);
    }

    clients.forEach(function (socketListId) {
      if (!connections[socketListId]) {
        connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
        //Wait for their ice candidate
        connections[socketListId].onicecandidate = function (event) {
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
        /*
        connections[socketListId].onaddstream = (event) => {
          // gotRemoteStream(event.stream, socketListId);
        };
        */
        connections[socketListId].ontrack = (event) => {
          gotRemoteStream(event.streams[0], socketListId);
        };

        //Add the local video stream
        // connections[socketListId].addStream(localStream);
        localStream.getTracks().forEach((track) => {
          connections[socketListId].addTrack(track, localStream);
        });
      }
    });

    //Create an offer to connect with your local description

    if (clients.length >= 2) {
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

  socket.on("endCallForAll", () => {
    endCall();
  });

  socket.on("createMessage", (message, id) => {
    var ul = document.getElementById("messageadd");
    var li = document.createElement("li");
    const isUserMsgClass = socketId === id ? "" : "right";
    li.className = `message ${isUserMsgClass}`;
    let txt = message.name + " : " + message.content;
    li.appendChild(document.createTextNode(txt));
    ul.appendChild(li);
  });

  socket.on("broadcast-message", (id, message) => {
    if (message.hasOwnProperty("isMuted")) {
      let divElem;
      if (id === socketId) {
        divElem = document.querySelector('[data-audioIcon="localAudio"]');
      } else {
        divElem = document.querySelector('[data-audioIcon="' + id + '"]');
      }

      if (divElem) {
        if (message.isMuted) {
          divElem.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        } else {
          divElem.innerHTML = "";
        }
      }
    } else if (message.hasOwnProperty("isVideoMuted")) {
      if (message.isVideoMuted) {
        console.log("video off", id);
      } else {
        console.log("video on", id);
      }
    } else if (message.hasOwnProperty("isScreenShare")) {
      if (message.isScreenShare) {
        console.log("screenshare started", id);
      } else {
        console.log("screenshare stopped", id);
      }
    }
  });
};

function pageReady() {
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
      .then(socketHandler);
  } else {
    alert("Your browser does not support getUserMedia API");
  }
}

const setVideoWidths = () => {
  let totalUsers = document.getElementsByTagName("video").length;
  if (totalUsers > 1) {
    for (let index = 0; index < totalUsers; index++) {
      document.getElementsByTagName("video")[index].style.width =
        100 / totalUsers + "%";
    }
  }
};

const videoDivHtml = (stream, id, video) => {
  var div = document.createElement("div");

  video.setAttribute("data-socket", id);
  video.srcObject = stream;
  video.autoplay = true;
  // video.muted = true;
  video.playsinline = true;

  let newDiv = document.createElement("div");
  newDiv.classList.add("audioiconpeer");
  newDiv.setAttribute("data-audioIcon", id);
  // newDiv.innerHTML = '<i class="fas fa-microphone"></i>';
  div.appendChild(newDiv);

  div.appendChild(video);
  div.classList.add("video-grid");

  const videoGrids = document.getElementById("video-grids");
  videoGrids.appendChild(div);

  setVideoWidths();
};

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo = document.createElement("video");
  videoDivHtml(stream, "localAudio", localVideo);

  initStreams();
}

function gotRemoteStream(stream, id) {
  var video = document.querySelector('[data-socket="' + id + '"]');
  if (!video || (video && video.srcObject !== stream)) {
    var videoElem = document.createElement("video");
    videoDivHtml(stream, id, videoElem);
  }

  if (screenSharing) {
    setTimeout(() => {
      replaceStreams(connections[id], screenStream);
    }, 1000); // dont remove this timeout
  }
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

const sendmessage = (text) => {
  if (event.key === "Enter" && text.value != "") {
    socket.emit("messagesend", { name: myname, content: text.value });
    text.value = "";
    main__chat_window.scrollTop = main__chat_window.scrollHeight;
  }
};

const sendPostMessageToParent = (msgObj) => {
  if (window.parent) {
    window.parent.postMessage(msgObj, "*");
  }
};

const endCall = () => {
  sendPostMessageToParent({ eventType: "endCall" });
  window.location.replace("/");
};

const endCallForAll = () => {
  sendPostMessageToParent({ eventType: "endCallForAll" });
  socket.emit("endCallForAll", "");
  window.location.replace("/");
};

const visitNotesClick = () => {
  sendPostMessageToParent({ eventType: "visitNotes" });
};

const initStreams = () => {
  var element = document.getElementById("mute-icon");
  var muteText = document.getElementById("muteText");
  if (defaultConfigObj.startWithAudioMuted === "true") {
    myVideoStream.getAudioTracks()[0].enabled = false;
    element.classList.add("fa-microphone-slash");
    element.classList.remove("fa-microphone");
    muteText.innerHTML = "Unmute";
  }

  var element1 = document.getElementById("video-icon");
  var videoText = document.getElementById("videoText");
  if (defaultConfigObj.startWithVideoMuted === "true") {
    myVideoStream.getVideoTracks()[0].enabled = false;
    element1.classList.add("fa-video-slash");
    element1.classList.remove("fa-video");
    videoText.innerHTML = "Start Video";
  }
};

const muteUnmute = () => {
  const enabled = localStream.getAudioTracks()[0].enabled;
  var element = document.getElementById("mute-icon");
  var muteText = document.getElementById("muteText");
  if (enabled) {
    localStream.getAudioTracks()[0].enabled = false;
    element.classList.add("fa-microphone-slash");
    element.classList.remove("fa-microphone");
    muteText.innerHTML = "Unmute";
    socket.emit("message", { isMuted: true });
  } else {
    localStream.getAudioTracks()[0].enabled = true;
    element.classList.add("fa-microphone");
    element.classList.remove("fa-microphone-slash");
    muteText.innerHTML = "Mute";
    socket.emit("message", { isMuted: false });
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
    socket.emit("message", { isVideoMuted: true });
  } else {
    localStream.getVideoTracks()[0].enabled = true;
    element.classList.add("fa-video");
    element.classList.remove("fa-video-slash");
    videoText.innerHTML = "Stop Video";
    socket.emit("message", { isVideoMuted: false });
  }
};

const showchat = () => {
  if (chat.hidden == false) {
    chat.hidden = true;
  } else {
    chat.hidden = false;
  }
};

const invitebox = () => {
  alert("invite clicked : coming soon");
};

function setScreenSharingStream(stream) {
  localVideo.srcObject = stream;
  localVideo.muted = true;
  localVideo.play();
}

function stopScreenSharingStream() {
  localVideo.srcObject = localStream;
  localVideo.muted = false;
  localVideo.play();
}

const replaceStreams = (peerObj, streamData) => {
  let videoTrack = streamData.getVideoTracks()[0];
  peerObj?.getSenders().map((sender) => {
    if (sender.track.kind == videoTrack.kind) {
      sender.replaceTrack(videoTrack);
    }
  });
};

function startScreenShare() {
  if (screenSharing) {
    stopScreenSharing();
  }
  const options = {
    audio: true,
    video: { displaySurface: "monitor" },
  };
  navigator.mediaDevices.getDisplayMedia(options).then((stream) => {
    screenStream = stream;
    setScreenSharingStream(stream);

    let videoTrack = screenStream.getVideoTracks()[0];
    videoTrack.onended = () => {
      stopScreenSharing();
    };

    Object.keys(connections).forEach((item) => {
      replaceStreams(connections[item], screenStream);
    });

    document.getElementById("screenShare").style.visibility = "hidden";
    screenSharing = true;
    socket.emit("message", { isScreenShare: true });
  });
}

function stopScreenSharing() {
  if (!screenSharing) return;
  stopScreenSharingStream();

  Object.keys(connections).forEach((item) => {
    replaceStreams(connections[item], localStream);
  });

  screenStream.getTracks().forEach(function (track) {
    track.stop();
  });
  document.getElementById("screenShare").style.visibility = "visible";
  screenSharing = false;
  socket.emit("message", { isScreenShare: false });
}
