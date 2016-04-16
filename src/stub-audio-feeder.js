(function() {

  function StubAudioFeeder(options) {
    throw new Error("No supported audio output on this system");
  }

  StubAudioFeeder.prototype = Object.create(BaseAudioFeeder.prototype);

  StubAudioFeeder.isSupported = function() {
    return false;
  };

  StubAudioFeeder.initSharedAudioContext = function() {
    // nothing to do
	};

})();
