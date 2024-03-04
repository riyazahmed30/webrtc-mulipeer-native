const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const url = require("url");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  allowEIO3: true, // false by default
  cors: {
    origin: "*",
  },
});

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
    socket.join(roomId);

    let roomSockets = await io.in(roomId).fetchSockets();
    roomSockets = roomSockets.map((v) => v.id);
    console.log(roomSockets);
    io.to(roomId).emit(
      "user-joined",
      socket.id,
      io.engine.clientsCount,
      roomSockets
    );

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("message", function (data) {
      io.to(roomId).emit("broadcast-message", socket.id, data);
    });

    socket.on("disconnect", function () {
      io.to(roomId).emit("user-left", socket.id);
    });
  });
});

// START THE SERVER =================================================================
const port = process.env.PORT || 8003;
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
