(function() {

  var AudioContext = window.AudioContext || window.webkitAudioContext,
    BufferQueue = require('./buffer-queue.js');

  /**
   * AudioFeeder backend using Web Audio API.
   *
   * @copyright (c) 2013-2016 Brion Vibber <brion@pobox.com>
   * @license MIT
   */
  function WebAudioBackend(numChannels, sampleRate, options) {
    var context = options.audioContext || WebAudioBackend.initSharedAudioContext();

    this._context = context;

    this.rate = context.sampleRate;
    this.channels = Math.min(numChannels, 2); // @fixme remove this limit
    this.bufferSize = 4096 || (options.bufferSize | 0);

    this._bufferQueue = new BufferQueue(this.channels);
    this._playbackTimeAtBufferTail = context.currentTime;
    this._queuedTime = 0;
    this._delayedTime = 0;
    this._dropped = 0;

    // @todo support new audio worker mode too
    if (context.createScriptProcessor) {
      this._node = context.createScriptProcessor(this.bufferSize, 0, this.channels);
    } else if (context.createJavaScriptNode) {
      // In older Safari versions
      this._node = context.createJavaScriptNode(this.bufferSize, 0, this.channels);
    } else {
      throw new Error("Bad version of web audio API?");
    }
  }

  /**
   * onaudioprocess event handler for the ScriptProcessorNode
   */
  WebAudioBackend.prototype._audioProcess = function(event) {
    var channel, input, output, i, playbackTime;
    if (typeof event.playbackTime === 'number') {
      playbackTime = event.playbackTime;
    } else {
      // Safari 6.1 hack
      playbackTime = this._context.currentTime + (this.bufferSize / this.rate);
    }

    var expectedTime = this._playbackTimeAtBufferTail;
    if (expectedTime < playbackTime) {
      // we may have lost some time while something ran too slow
      this._delayedTime += (playbackTime - expectedTime);
    }

    if (this._bufferQueue.samplesQueued() < this.bufferSize) {
      // We might be in a throttled background tab; go ping the decoder
      // and let it know we need more data now!
      // @todo use standard event firing?
      if (this.onstarved) {
        this.onstarved();
      }
    }

    // If we still haven't got enough data, write a buffer of silence
    // to all channels and record an underrun event.
    // @todo go ahead and output the data we _do_ have?
    if (this._bufferQueue.samplesQueued() < this.bufferSize) {
      for (channel = 0; channel < this.channels; channel++) {
        output = event.outputBuffer.getChannelData(channel);
        for (i = 0; i < this.bufferSize; i++) {
          output[i] = 0;
        }
      }
      this._dropped++;
      return;
    }

    // @todo adjust volume on a full scale as well as the mute param
    var volume = (this._muted ? 0 : 1);

    // Actually get that data and write it out...
    var inputBuffer = this._bufferQueue.shift(this.bufferSize);
    if (inputBuffer[0].length < this.bufferSize) {
      // This should not happen, but trust no invariants!
      throw 'Audio buffer not expected length.';
    }
    for (channel = 0; channel < this.channels; channel++) {
      input = inputBuffer[channel];
      output = event.outputBuffer.getChannelData(channel);
      for (i = 0; i < input.length; i++) {
        output[i] = input[i] * volume;
      }
    }
    this._queuedTime += (this.bufferSize / this.rate);
    this._playbackTimeAtBufferTail = playbackTime + (this.bufferSize / this.rate);
  };


  /**
   * Return a count of samples that have been queued or output but not yet played.
   *
   * @return {number} sample count
   */
  WebAudioBackend.prototype._samplesQueued = function() {
    var bufferedSamples = this._bufferQueue.samplesQueued();
    var remainingSamples = Math.floor(this._timeAwaitingPlayback() * this.rate);

    return bufferedSamples + remainingSamples;
  };

  /**
   * Return time duration before between the present and the endpoint of audio
   * we have alreaady sent out to Web Audio for playback.
   *
   * @return {number} seconds
   */
  WebAudioBackend.prototype._timeAwaitingPlayback = function() {
    return Math.max(0, this._playbackTimeAtBufferTail - this._context.currentTime);
  };

  WebAudioBackend.prototype.getPlaybackState = function() {
    return {
      playbackPosition: this._queuedTime - this._timeAwaitingPlayback(),
      samplesQueued: this._samplesQueued(),
      dropped: this._dropped,
      delayed: this._delayedTime
    };
  };

  WebAudioBackend.prototype.waitUntilReady = function(callback) {
    callback();
  };

  WebAudioBackend.prototype.appendBuffer = function(buffer) {
    this._bufferQueue.appendBuffer(buffer);
  };

  WebAudioBackend.prototype.start = function() {
    this._node.onaudioprocess = this._audioProcess.bind(this);
    this._node.connect(this._context.destination);
    this._playbackTimeAtBufferTail = this._context.currentTime;
  };

  WebAudioBackend.prototype.stop = function() {
    if (this._node) {
      this._node.onaudioprocess = null;
      this._node.disconnect();
    }
  };

  WebAudioBackend.prototype.close = function() {
    this.stop();

    this._context = null;
    this._buffers = null;
  };

  WebAudioBackend.isSupported = function() {
    return !!AudioContext;
  };

  WebAudioBackend.initSharedAudioContext = function() {
		if (WebAudioBackend.sharedAudioContext === null) {
			if (AudioContext) {
				// We're only allowed 4 contexts on many browsers
				// and there's no way to discard them (!)...
				var context = WebAudioBackend.sharedAudioContext = new AudioContext(),
					node;
				if (context.createScriptProcessor) {
					node = context.createScriptProcessor(1024, 0, 2);
				} else if (context.createJavaScriptNode) {
					node = context.createJavaScriptNode(1024, 0, 2);
				} else {
					throw new Error( "Bad version of web audio API?" );
				}

				// Don't actually run any audio, just start & stop the node
				node.connect(context.destination);
				node.disconnect();
			}
		}
    return WebAudioBackend.sharedAudioContext;
	};

})();
