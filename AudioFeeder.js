var AudioFeeder;

(function() {

	if (WebAudioFeeder.isSupported()) {
		AudioFeeder = WebAudioFeeder;
	} else if (FlashAudioFeeder) {
		AudioFeeder = FlashAudioFeeder;
	} else {
		AudioFeeder = StubAudioFeeder;
	}

	/**
	 * Object that we can throw audio data into and have it drain out.
	 *
	 * @param options: dictionary of config settings:
	 *                 'base' - Base URL to find additional resources in,
	 *                          such as the Flash audio output shim
	 *                 'audioContext' - AudioContext instance to use in
	 *                          place of creating a default one
	 *
	 * @throws Error if browser is missing required support
	 */
	AudioFeeder = function(options) {
		var self = this;
		options = options || {};

		var bufferSize = this.bufferSize = 4096,
			channels = 0, // call init()!
			rate = 0; // call init()!

		// Always create stereo output. For iOS we have to set this stuff up
		// before we've actually gotten the info from the codec because we
		// must initialize from a UI event. Bah!
		var outputChannels = 2;

		var buffers = [],
			context,
			node,
			pendingBuffer = freshBuffer(),
			pendingPos = 0,
			muted = false,
			queuedTime = 0,
			playbackTimeAtBufferTail = -1,
			targetRate,
			dropped = 0,
			delayedTime = 0;

		/**
		 * Start setting up output with the given channel count and sample rate.
		 *
		 * @param numChannels: Integer
		 * @param sampleRate: Integer
		 *
		 * @todo merge into constructor?
		 */
		this.init = function(numChannels, sampleRate) {
			rate = sampleRate;
			channels = numChannels;
		};

		/**
		 * Buffer data
		 * @param samplesPerChannel: Array of Float32Arrays
		 *
		 * @todo throw if data invalid or uneven
		 */
		this.bufferData = function(samplesPerChannel) {
		};

		/**
		 * Get an object with information about the current playback state.
		 *
		 * @todo cleanup names and units
		 *
		 * @return {
		 *   playbackPosition: {number} seconds, with a system-provided base time
		 *   samplesQueued: {int}
		 *   dropped: {int}
		 * }
		 */
		this.getPlaybackState = function() {
		};

		/**
		 * @todo replace with volume property
		 */
		this.mute = function() {
			this.muted = muted = true;
		};

		/**
		 * @todo replace with volume property
		 */
		this.unmute = function() {
			this.muted = muted = false;
		};

		/**
		 * Close out the audio channel. The AudioFeeder instance will no
		 * longer be usable after closing.
		 *
		 * @todo close out the AudioContext if no longer needed
		 * @todo make the instance respond more consistently once closed
		 */
		this.close = function() {
		};

		/**
		 * Checks if audio system is ready and calls the callback when ready
		 * to begin playback.
		 *
		 * This will wait for the Flash shim to load on IE 10/11; waiting
		 * is not required when using native Web Audio but you should use
		 * this callback to support older browsers.
		 */
		this.waitUntilReady = function(callback) {
		};

		/**
		 * Start/continue playback as soon as possible.
		 *
		 * You should buffer some audio ahead of time to avoid immediately
		 * running into starvation.
		 */
		this.start = function() {
		};

		/**
		 * Stop/pause playback as soon as possible.
		 *
		 * Audio that has been buffered but not yet sent to the device will
		 * remain buffered, and can be continued with another call to start().
		 */
		this.stop = function() {
		};

		/**
		 * A callback when we find we're out of buffered data.
		 */
		this.onstarved = null;
	};

	/**
	 * Is the AudioFeeder class supported in this browser?
	 *
	 * Note that it's still possible to be supported but not work, for instance
	 * if there are no audio output devices but the APIs are available.
	 *
	 * @return boolean
	 */
	BaseAudioFeeder.isSupported = function() {
		return !!Float32Array;
	};

	/**
	 * The AudioContext instance managed by AudioFeeder class, if any.
	 * @property AudioContext
	 */
	AudioFeeder.sharedAudioContext = null;

	/**
	 * Force initialization of AudioFeeder.sharedAudioContext.
	 *
	 * Some browser (such as mobile Safari) disable audio output unless
	 * first triggered from a UI event handler; call this method as a hint
	 * that you will be starting up an AudioFeeder soon but won't have data
	 * for it until a later callback.
	 */
	AudioFeeder.initSharedAudioContext = function() {
	};

})();

// For browserify
if (typeof module === 'object' && typeof module.exports === 'object') {
	module.exports = AudioFeeder;
}
