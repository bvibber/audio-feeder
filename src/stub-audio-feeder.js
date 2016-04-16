(function() {

  function StubAudioFeeder(numChannels, sampleRate, options) {
    this.channels = numChannels;
    this.rate = sampleRate;
  }

  StubAudioFeeder.isSupported = function() {
    // always works!
    return true;
  };

  StubAudioFeeder.initSharedAudioContext = function() {
    // nothing to do
	};

  StubAudioFeeder.appendBuffer = function(buffer) {
    // no-op for now
  }
})();
