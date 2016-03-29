(function() {

  function FlashAudioFeeder(options) {
    BaseAudioFeeder.apply(this, options);
  }
  FlashAudioFeeder.prototype = Object.create(BaseAudioFeeder.prototype);

  FlashAudioFeeder.prototype.init = function(numChannels, sampleRate) {
    AudioFeederBase.prototype.init.apply(this, numChannels, sampleRate);
    this._targetRate = this.targetRate = 44100;

    var flashOptions = {};
    if (typeof this._options.base === 'string') {
      flashOptions.swf = this._options.base + '/dynamicaudio.swf?version=' + OGVVersion;
    }
    this._flashaudio = new DynamicAudio(flashOptions);
    this._flashBuffer = '';
    this._flushTimeout = null;
    this._cachedFlashState = null;
    this._cachedFlashTime = 0;
    this._cachedFlashInterval = 40; // resync state no more often than every X ms
  };

  /**
   * Resampling, scaling and reordering for the Flash fallback.
   * The Flash fallback expects 44.1 kHz, stereo
   * Resampling: This is horribly naive and wrong.
   * TODO: Replace me with a better algo!
   */
  FlashAudioFeeder.prototype._resampleFlash = function(samples) {
  	var sampleincr = this.rate / 44100;
  	var samplecount = (samples[0].length * (44100 / this.rate)) | 0;
  	var newSamples = new Int16Array(samplecount * 2);
  	var chanLeft = samples[0];
  	var chanRight = this.channels > 1 ? samples[1] : chanLeft;
  	var multiplier = 16384; // smaller than 32768 to allow some headroom from those floats
  	for(var s = 0; s < samplecount; s++) {
  		var idx = (s * sampleincr) | 0;
  		var idx_out = s * 2;
  		// Use a smaller
  		newSamples[idx_out] = chanLeft[idx] * multiplier;
  		newSamples[idx_out + 1] = chanRight[idx] * multiplier;
  	}
  	return newSamples;
  };

  var hexDigits = ['0', '1', '2', '3', '4', '5', '6', '7',
           '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
  var hexBytes = [];
  for (var i = 0; i < 256; i++) {
    hexBytes[i] = hexDigits[(i & 0x0f)] +
            hexDigits[(i & 0xf0) >> 4];
  }
  function hexString(buffer) {
    var samples = new Uint8Array(buffer);
    var digits = "",
      len = samples.length;
    for (var i = 0; i < len; i++) {
      // Note that in IE 11 strong concatenation is twice as fast as
      // the traditional make-an-array-and-join here.
      digits += hexBytes[samples[i]];
    }
    return digits;
  }

  FlashAudioFeeder.prototype.flushFlashBuffer = function() {
    var chunk = this._flashBuffer,
      flashElement = this._flashaudio.flashElement;
    this.waitUntilReady(function() {
      flashElement.write(chunk);
    });
    this._flashBuffer = '';
    this._flushTimeout = null;
  };

  this.bufferData = function(samplesPerChannel) {
    var resamples = this._resampleFlash(samplesPerChannel);
    var flashElement = this._flashaudio.flashElement;
    if (resamples.length > 0) {
      var str = hexString(resamples.buffer);
      this._flashBuffer += str;
      if (!this._flushTimeout) {
        // consolidate multiple consecutive tiny buffers in one pass;
        // pushing data to Flash is relatively expensive on slow machines
        this._flushTimeout = setTimeout(this._flushFlashBuffer.bind(this), 0);
      }
    }
  };

  FlashAudioFeeder.prototype.getPlaybackState = function() {
    var flashElement = this._flashaudio.flashElement;
    if (flashElement.write) {
      var now = Date.now(),
        delta = now - this._cachedFlashTime,
        state;
      if (this._cachedFlashState && delta < this._cachedFlashInterval) {
        var cachedFlashState = this._cachedFlashState;
        state = {
          playbackPosition: cachedFlashState.playbackPosition + delta / 1000,
          samplesQueued: cachedFlashState.samplesQueued - delta * this._targetRate / 1000,
          dropped: cachedFlashState.dropped,
          delayed: cachedFlashState.delayed
        };
      } else {
        state = flashElement.getPlaybackState();
        this._cachedFlashState = state;
        this._cachedFlashTime = now;
      }
      state.samplesQueued += this._flashBuffer.length / 2;
      return state;
    } else {
      //console.log('getPlaybackState USED TOO EARLY');
      return {
        playbackPosition: 0,
        samplesQueued: 0,
        dropped: 0,
        delayed: 0
      };
    }
  };

  FlashAudioFeeder.prototype.close = function() {
    this.stop();

    var wrapper = this._flashaudio.flashWrapper;
    wrapper.parentNode.removeChild(wrapper);
    this._flashaudio = null;
  };

  FlashAudioFeeder.prototype.waitUntilReady = function(callback) {
    var self = this,
      times = 0,
      maxTimes = 100;
    function pingFlashPlugin() {
      setTimeout(function doPingFlashPlugin() {
        times++;
        if (self._flashaudio && self._flashaudio.flashElement.write) {
          callback();
        } else if (times > maxTimes) {
          console.log("Failed to initialize Flash audio shim");
          self.close();
          callback();
        } else {
          pingFlashPlugin();
        }
      }, 20);
    }
    if (self._flashaudio && self.flashaudio.flashElement.write) {
      callback();
    } else {
      pingFlashPlugin();
    }
  };

  FlashAudioFeeder.prototype.start = function() {
    this.flashaudio.flashElement.start();
  };

  FlashAudioFeeder.prototype.stop = function() {
    this.flashaudio.flashElement.stop();
  };

  FlashAudioFeeder.isSupported = function() {
    if (!BaseAudioFeeder.isSupported()) {
      return false;
    }
		if (navigator.userAgent.indexOf('Trident') !== -1) {
			// We only do the ActiveX test because we only need Flash in
			// Internet Explorer 10/11. Other browsers use Web Audio directly
			// (Edge, Safari) or native playback, so there's no need to test
			// other ways of loading Flash.
			try {
				var obj = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
				return true;
			} catch(e) {
				return false;
			}
		}
		return false;
  };

  FlashAudioFeeder.initSharedAudioContext = function() {
    // nothing to do
	};

	/** Flash fallback **/

	/*
	The Flash fallback is based on https://github.com/an146/dynamicaudio.js

	This is the contents of the LICENSE file:

	Copyright (c) 2010, Ben Firshman
	All rights reserved.

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:

	 * Redistributions of source code must retain the above copyright notice, this
	   list of conditions and the following disclaimer.
	 * Redistributions in binary form must reproduce the above copyright notice,
	   this list of conditions and the following disclaimer in the documentation
	   and/or other materials provided with the distribution.
	 * The names of its contributors may not be used to endorse or promote products
	   derived from this software without specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	*/


	function DynamicAudio(args) {
		if (this instanceof arguments.callee) {
			if (typeof this.init === "function") {
				this.init.apply(this, (args && args.callee) ? args : arguments);
			}
		} else {
			return new arguments.callee(arguments);
		}
	}


	DynamicAudio.nextId = 1;

	DynamicAudio.prototype = {
		nextId: null,
		swf: 'dynamicaudio.swf?' + Math.random(),

		flashWrapper: null,
		flashElement: null,

		init: function(opts) {
			var self = this;
			self.id = DynamicAudio.nextId++;

			if (opts && typeof opts.swf !== 'undefined') {
				self.swf = opts.swf;
			}


			self.flashWrapper = document.createElement('div');
			self.flashWrapper.id = 'dynamicaudio-flashwrapper-'+self.id;
			// Credit to SoundManager2 for this:
			var s = self.flashWrapper.style;
			s.position = 'fixed';
			s.width = '11px'; // must be at least 6px for flash to run fast
			s.height = '11px';
			s.bottom = s.left = '0px';
			s.overflow = 'hidden';
			self.flashElement = document.createElement('div');
			self.flashElement.id = 'dynamicaudio-flashelement-'+self.id;
			self.flashWrapper.appendChild(self.flashElement);

			document.body.appendChild(self.flashWrapper);

			var id = self.flashElement.id;

			self.flashWrapper.innerHTML = "<object id='"+id+"' width='10' height='10' type='application/x-shockwave-flash' data='"+self.swf+"' style='visibility: visible;'><param name='allowscriptaccess' value='always'></object>";
			self.flashElement = document.getElementById(id);
		},
	};

})();
