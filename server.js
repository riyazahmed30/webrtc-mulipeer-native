const express = require("express");
const http = require("http");
const url = require("url");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.Server(app);
const io = require("socket.io")(server);

/*
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
*/

app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/join", (req, res) => {
  res.redirect(
    url.format({
      pathname: `/join/${uuidv4()}`,
      query: req.query,
    })
  );
});

app.get("/joinold", (req, res) => {
  res.redirect(
    url.format({
      pathname: `/join/${req.query.meeting_id}`,
      query: req.query,
    })
  );
});

app.get("/join/:rooms", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

io.on("connection", async (socket) => {
  socket.on("join-room", async (roomId, myname) => {
    const socketId = socket.id;
    socket.join(roomId);

    let roomSockets = await io.in(roomId).fetchSockets();
    roomSockets = roomSockets.map((v) => v.id);
    io.to(roomId).emit("user-joined", socketId, roomSockets, myname);

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socketId, message);
    });

    socket.on("message", function (data) {
      io.to(roomId).emit("broadcast-message", socketId, data);
    });

    socket.on("disconnect", function () {
      io.to(roomId).emit("user-left", socketId, myname);
    });

    socket.on("endCallForAll", () => {
      io.to(roomId).emit("endCallForAll", "");
    });

    socket.on("messagesend", (message) => {
      io.to(roomId).emit("createMessage", message, socketId);
    });
  });
});

// START THE SERVER =================================================================
const port = process.env.PORT || 8003;
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
