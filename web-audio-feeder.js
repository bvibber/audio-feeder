(function() {

  var AudioContext = window.AudioContext || window.webkitAudioContext;

  function WebAudioFeeder(options) {
    BaseAudioFeeder.apply(this, options);
    if (typeof options.audioContext !== 'undefined') {
      // We were passed a pre-existing AudioContext object,
      // in the hopes this gets around iOS's weird activation rules.
      this._context = options.audioContext;
    } else {
      this._context = null;
    }
  }

  WebAudioFeeder.prototype = Object.create(BaseAudioFeeder.prototype);

  WebAudioFeeder.prototype.init = function(numChannels, sampleRate) {
    if (!this._context) {
      AudioFeeder.initSharedAudioContext();
      this._context = AudioFeeder.sharedAudioContext;
    }
    var context = this._context;
    this._playbackTimeAtBufferTail = context.currentTime;

    if (context.createScriptProcessor) {
      this._node = context.createScriptProcessor(this._bufferSize, 0, this._outputChannels);
    } else if (context.createJavaScriptNode) {
      this._node = context.createJavaScriptNode(bufferSize, 0, this._outputChannels);
    } else {
      throw new Error("Bad version of web audio API?");
    }
    this._targetRate = context.sampleRate;
    this._pendingBuffer = this._freshBuffer();
  };

	WebAudioFeeder.prototype._freshBuffer = function() {
		var buffer = [];
		for (var channel = 0; channel < this._outputChannels; channel++) {
			buffer[channel] = new Float32Array(this._bufferSize);
		}
		return buffer;
	};

  WebAudioFeeder.prototype._popNextBuffer = function() {
    // hack hack
    // fixme: grab the right number of samples
    // and... rescale
    if (buffers.length > 0) {
      return buffers.shift();
    }
  };

  /**
   * onaudioprocess event handler for the ScriptProcessorNode
   */
  WebAudioFeeder.prototype._audioProcess = function(event) {
    var channel, input, output, i, playbackTime;
    if (typeof event.playbackTime === 'number') {
      playbackTime = event.playbackTime;
    } else {
      // Safari 6.1 hack
      playbackTime = context.currentTime + (this._bufferSize / this._targetRate);
    }

    var expectedTime = this._playbackTimeAtBufferTail;
    if (expectedTime < playbackTime) {
              // we may have lost some time while something ran too slow
              delayedTime += (playbackTime - expectedTime);
    }

    var inputBuffer = this._popNextBuffer(this._bufferSize);
    if (!inputBuffer) {
      // We might be in a throttled background tab; go ping the decoder
      // and let it know we need more data now!
      // @todo use standard event firing?
      if (this.onstarved) {
        this.onstarved();
        inputBuffer = this._popNextBuffer(this._bufferSize);
      }
    }

    // If we haven't got enough data, write a buffer of of silence to
    // both channels
    if (!inputBuffer) {
      for (channel = 0; channel < this._outputChannels; channel++) {
        output = event.outputBuffer.getChannelData(channel);
        for (i = 0; i < bufferSize; i++) {
          output[i] = 0;
        }
      }
      this._dropped++;
      return;
    }

    var volume = (this._muted ? 0 : 1);
    for (channel = 0; channel < this._outputChannels; channel++) {
      input = inputBuffer[channel];
      output = event.outputBuffer.getChannelData(channel);
      for (i = 0; i < Math.min(this._bufferSize, input.length); i++) {
        output[i] = input[i] * volume;
      }
    }
    this._queuedTime += (this._bufferSize / this._targetRate);
    this._playbackTimeAtBufferTail = playbackTime + (this._bufferSize / this._targetRate);
  };


	/**
	 * This is horribly naive and wrong.
	 * Replace me with a better algo!
	 */
	WebAudioFeeder.prototype._resample = function(samples) {
		if (this._rate == this._targetRate && this._channels == this._outputChannels) {
			return samples;
		} else {
			var newSamples = [];
			for (var channel = 0; channel < this._outputChannels; channel++) {
				var inputChannel = channel;
				if (channel >= this._channels) {
					inputChannel = 0;
				}
				var input = samples[inputChannel],
					output = new Float32Array(Math.round(input.length * this._targetRate / this._rate));
				for (var i = 0; i < output.length; i++) {
					output[i] = input[(i * this._rate / this._targetRate) | 0];
				}
				newSamples.push(output);
			}
			return newSamples;
		}
	};

	WebAudioFeeder.prototype._pushSamples = function(samples) {
		var firstChannel = samples[0],
			sampleCount = firstChannel.length;
		for (var i = 0; i < sampleCount; i++) {
			for (var channel = 0; channel < outputChannels; channel++) {
				pendingBuffer[channel][pendingPos] = samples[channel][i];
			}
			if (++pendingPos == bufferSize) {
				buffers.push(pendingBuffer);
				pendingPos = 0;
				pendingBuffer = freshBuffer();
			}
		}
	};

  WebAudioFeeder.prototype.bufferData = function(samplesPerChannel) {
    var samples = resample(samplesPerChannel);
    pushSamples(samples);
  };

  WebAudioFeeder.prototype._samplesQueued = function() {
    var numSamplesQueued = 0;
    this._buffers.forEach(function(buffer) {
      numSamplesQueued += buffer[0].length;
    });

    var bufferedSamples = numSamplesQueued;
    var remainingSamples = Math.floor(Math.max(0, (this._playbackTimeAtBufferTail - this._context.currentTime)) * this._context.sampleRate);

    return bufferedSamples + remainingSamples;
  };

  WebAudioFeeder.prototype.getPlaybackState = function() {
    return {
      playbackPosition: this._queuedTime - Math.max(0, this._playbackTimeAtBufferTail - this._context.currentTime),
      samplesQueued: this._samplesQueued(),
      dropped: this._dropped,
      delayed: this._delayedTime
    };
  };

  WebAudioFeeder.prototype.close = function() {
    this.stop();

    this._context = null;
    this._buffers = null;
  };

  WebAudioFeeder.prototype.waitUntilReady = function(callback) {
    callback();
  };

  WebAudioFeeder.prototype.start = function() {
    this._node.onaudioprocess = this._audioProcess.bind(this);
    this._node.connect(this._context.destination);
    playbackTimeAtBufferTail = this._context.currentTime;
  };

  WebAudioFeeder.prototype.stop = function() {
    if (this._node) {
      this._node.onaudioprocess = null;
      this._node.disconnect();
    }
  };

  WebAudioFeeder.isSupported = function() {
    return BaseAudioFeeder.isSupported() && !!AudioContext;
  };

  WebAudioFeeder.initSharedAudioContext = function() {
		if (WebAudioFeeder.sharedAudioContext === null) {
			if ( AudioContext ) {
				// We're only allowed 4 contexts on many browsers
				// and there's no way to discard them (!)...
				var context = WebAudioFeeder.sharedAudioContext = new AudioContext(),
					node;
				if ( context.createScriptProcessor ) {
					node = context.createScriptProcessor( 1024, 0, 2 );
				} else if ( context.createJavaScriptNode ) {
					node = context.createJavaScriptNode( 1024, 0, 2 );
				} else {
					throw new Error( "Bad version of web audio API?" );
				}

				// Don't actually run any audio, just start & stop the node
				node.connect(context.destination);
				node.disconnect();
			}
		}
	};

})();
