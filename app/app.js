const MESSAGE_TYPE = { SDP: 'SDP', CANDIDATE: 'CANDIDATE' };
const peerConnectionConfig = {
  iceServers: [
    { 'urls': 'stun:stun.stunprotocol.org:3478' },
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
};
const webSocketConn = new WebSocket('ws://localhost:1337');
const connections = [];
let currentRTCConnection = null;

window.addEventListener('DOMContentLoaded', onLoad);

function init() {
  webSocketConn.onmessage = handleWSMessage;
}

function onLoad() {
  document.getElementById('start').addEventListener('click', onStart, false);
}

async function onStart() {
  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

  document.getElementById('start').style.display = 'none';
  document.getElementById('chat-room').style.display = 'block';

  const peerConnection = setupRTCPeerConnection();

  localStream.getTracks().forEach(track => { peerConnection.addTrack(track, localStream) });
  document.getElementById('self-view').srcObject = localStream;
}

function setupRTCPeerConnection() {
  const peerConnection = new RTCPeerConnection(peerConnectionConfig);
  connections.push(peerConnection);
  currentRTCConnection = peerConnection;
  peerConnection.onicecandidate = event => onRTCIceCandidate(event, peerConnection);
  peerConnection.onnegotiationneeded = () => onRTCNegotiationNeeded(peerConnection);
  peerConnection.ontrack = onRTCTrack;
  return peerConnection;
}

function onRTCIceCandidate(event) {
  if (event.candidate) {
    webSocketConn.send(JSON.stringify({ message_type: MESSAGE_TYPE.CANDIDATE, content: event.candidate }));
  }
}

async function onRTCNegotiationNeeded(peerConnection) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  webSocketConn.send(JSON.stringify({ message_type: MESSAGE_TYPE.SDP, content: offer }));
}

function onRTCTrack(event) {
  const videoElem = document.getElementById('remote-view');
  if (!videoElem.srcObject) {
    videoElem.srcObject = event.streams[0];
  }
}

async function handleWSMessage(message) {
  const data = JSON.parse(message.data);
  if (!data) return;
  const { message_type, content } = data;
  try {
    if (message_type === MESSAGE_TYPE.CANDIDATE && content) {
      await currentRTCConnection.addIceCandidate(content);
    } else if (message_type === MESSAGE_TYPE.SDP) {
      await handleWSSDPMessage(content);
    } else {
      console.warn('Unknown SDP type: ', data);
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleWSSDPMessage(content) {
  if (currentRTCConnection == null)
    return;
  if (content.type === 'offer') {
    await currentRTCConnection.setRemoteDescription(content);
    const answer = await currentRTCConnection.createAnswer();
    await currentRTCConnection.setLocalDescription(answer);
    webSocketConn.send(JSON.stringify({ message_type: MESSAGE_TYPE.SDP, content: answer }));
  } else if (content.type === 'answer') {
    await currentRTCConnection.setRemoteDescription(content);
  } else {
    console.warn('Unsupported SDP type.');
  }
}

init();
