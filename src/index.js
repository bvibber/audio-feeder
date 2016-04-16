var AudioFeeder;

(function() {

	var BufferQueue = require('./buffer-queue.js'),
		Backend = require('./backend.js'),
		WebAudioBackend = require('./web-audio-backend.js'),
		FlashBackend = require('./flash-backend.js'),
		StubBackend = require('./stub-backend.js');

	/**
	 * Object that we can throw audio data into and have it drain out.
	 *
	 * @param options: dictionary of config settings:
	 *                 'base' - Base URL to find additional resources in,
	 *                          such as the Flash audio output shim
	 *                 'audioContext' - AudioContext instance to use in
	 *                          place of creating a default one
	 */
	AudioFeeder = function(options) {
		this._options = options || {};

		this.rate = 0; // pending init
		this.channels = 0; // pending init
		this.muted = false;

		this._backend = null; // AudioBackend instance, after init...

		this._queuedTime = 0;
	};

	/**
	 * Start setting up output with the given channel count and sample rate.
	 *
	 * @param numChannels: Integer
	 * @param sampleRate: Integer
	 *
	 * @todo merge into constructor?
	 */
	AudioFeeder.prototype.init = function(numChannels, sampleRate) {
		this.channels = numChannels;
		this.rate = sampleRate;

		if (WebAudioBackend.isSupported()) {
			this._backend = new WebAudioBackend(numChannels, sampleRate, this._options);
		} else if (FlashBackend.isSupported()) {
			this._backend = new FlashBackend(numChannels, sampleRate, this._options);
		} else {
			this._backend = new StubBackend(numChannels, sampleRate, this._options);
		}
	};

	/**
	 * Resample a buffer from the input rate/channel count to the output.
	 *
	 * This is horribly naive and wrong.
	 * Replace me with a better algo!
	 *
	 * @param samples: Array of Float32Arrays for each channel
	 * @param return Array of Float32Arrays for each channel
	 */
	AudioFeeder.prototype._resample = function(samples) {
		var rate = this.rate,
			channels = this.channels,
			targetRate = this._backend.rate,
			targetChannels = this._backend.channels;

		if (rate == targetRate && channels == targetChannels) {
			return samples;
		} else {
			var newSamples = [];
			for (var channel = 0; channel < targetChannels; channel++) {
				var inputChannel = channel;
				if (channel >= channels) {
					// Flash forces output to stereo; if input is mono, dupe the first channel
					inputChannel = 0;
				}
				var input = samples[inputChannel],
					output = new Float32Array(Math.round(input.length * targetRate / rate));
				for (var i = 0; i < output.length; i++) {
					output[i] = input[(i * rate / targetRate) | 0];
				}
				newSamples.push(output);
			}
			return newSamples;
		}
	};

	/**
	 * Buffer data
	 * @param sampleData: Array of Float32Arrays for each channel
	 *
	 * @todo throw if data invalid or uneven
	 */
	AudioFeeder.prototype.bufferData = function(sampleData) {
		if (this._backend) {
			var samples = this._resample(sampleData);
			this._backend.appendBuffer(samples);
		}
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
	AudioFeeder.prototype.getPlaybackState = function() {
		return this._backend.getPlaybackState();
	};

	/**
	 * @todo replace with volume property
	 */
	AudioFeeder.prototype.mute = function() {
		this.muted = true;
		this._backend.mute();
	};

	/**
	 * @todo replace with volume property
	 */
	AudioFeeder.prototype.unmute = function() {
		this.muted = false;
		this._backend.unmute();
	};

	/**
	 * Close out the audio channel. The AudioFeeder instance will no
	 * longer be usable after closing.
	 *
	 * @todo close out the AudioContext if no longer needed
	 * @todo make the instance respond more consistently once closed
	 */
	AudioFeeder.prototype.close = function() {
		if (this._backend) {
			this._backend.close();
			this._backend = null;
		}
	};

	/**
	 * Checks if audio system is ready and calls the callback when ready
	 * to begin playback.
	 *
	 * This will wait for the Flash shim to load on IE 10/11; waiting
	 * is not required when using native Web Audio but you should use
	 * this callback to support older browsers.
	 */
	AudioFeeder.prototype.waitUntilReady = function(callback) {
		if (this._backend) {
			this._backend.waitUntilReady(callback);
		} else {
			throw 'Invalid state: AudioFeeder cannot waitUntilReady before init';
		}
	};

	/**
	 * Start/continue playback as soon as possible.
	 *
	 * You should buffer some audio ahead of time to avoid immediately
	 * running into starvation.
	 */
	AudioFeeder.prototype.start = function() {
		if (this._backend) {
			this._backend.start();
		} else {
			throw 'Invalid state: AudioFeeder cannot start before init';
		}
	};

	/**
	 * Stop/pause playback as soon as possible.
	 *
	 * Audio that has been buffered but not yet sent to the device will
	 * remain buffered, and can be continued with another call to start().
	 */
	AudioFeeder.prototype.stop = function() {
		if (this._backend) {
			this._backend.stop();
		} else {
			throw 'Invalid state: AudioFeeder cannot stop before init';
		}
	};

	/**
	 * A callback when we find we're out of buffered data.
	 */
	AudioFeeder.prototype.onstarved = null;

	/**
	 * Is the AudioFeeder class supported in this browser?
	 *
	 * Note that it's still possible to be supported but not work, for instance
	 * if there are no audio output devices but the APIs are available.
	 *
	 * @return boolean
	 */
	AudioFeeder.isSupported = function() {
		return !!Float32Array && (WebAudioBackend.isSupported() || FlashBackend.isSupported());
	};

	/**
	 * Force initialization of AudioFeeder.sharedAudioContext.
	 *
	 * Some browsers (such as mobile Safari) disable audio output unless
	 * first triggered from a UI event handler; call this method as a hint
	 * that you will be starting up an AudioFeeder soon but won't have data
	 * for it until a later callback.
	 */
	AudioFeeder.initSharedAudioContext = function() {
		if (WebAudioBackend.isSupported()) {
			WebAudioBackend.initSharedAudioContext();
		}
	};

})();

// For browserify & webpack
if (typeof module === 'object' && typeof module.exports === 'object') {
	module.exports = AudioFeeder;
}
