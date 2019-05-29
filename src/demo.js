module.exports = function demo() {

  // Note: this demo is using the pre-built AudioFeeder.js rather than
  // including it locally via webpack.
  /* global AudioFeeder */

  var demoHtml = require('file?name=[name].[ext]!../assets/demo.html');

  var start = document.getElementById('start'),
    stop = document.getElementById('stop'),
    channels = 1,
    rate = 48000,
    sampleCounter = 0,
    feeder = new AudioFeeder(),
    initialized = false;

  function bufferSineWave(time) {
    var freq = 261, // middle C
      chunkSamples = Math.round(time * rate), // buffer 1s at a time
      samples = Math.ceil(chunkSamples / freq) * freq,
      buffer = new Float32Array(samples),
      packet = [buffer];

    for (var i = 0; i < samples; i++) {
      buffer[i] = Math.sin((sampleCounter / rate) * freq * 2 * Math.PI);
      sampleCounter++;
    }

    feeder.bufferData(packet);
  }

  start.addEventListener('click', function() {
    start.disabled = true;
    stop.disabled = false;

    var startFn = function() {
      bufferSineWave(1); // pre-buffer 1s
      feeder.tempo = 0.3;
      feeder.start();
    };

    if (!initialized) {
      feeder.init(channels, rate);
      feeder.waitUntilReady(startFn);
      initialized = true;
    } else startFn();

  });

  stop.addEventListener('click', function() {
    stop.disabled = true;
    start.disabled = false;
    feeder.stop();
  });

  feeder.onbufferlow = function() {
    console.log('buffer low');
    while (feeder.durationBuffered < feeder.bufferThreshold * 2) {
      bufferSineWave(1);
    }
  };

  feeder.onstarved = function() {
    console.log('starving');
    bufferSineWave();
  };

  var muted = document.querySelector('input[name=muted]');
  muted.addEventListener('click', function() {
    feeder.muted = this.checked;
  });

  var volumes = document.querySelectorAll('input[name=volume]');
  for (var i = 0; i < volumes.length; i++) {
    volumes[i].addEventListener('click', function() {
      feeder.volume = parseInt(this.value) / 100;
    });
  }

  start.disabled = false;
};
