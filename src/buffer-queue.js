/**
 * @file Abstraction around a queue of audio buffers.
 *
 * @author Brion Vibber <brion@pobox.com>
 * @copyright (c) 2013-2016 Brion Vibber
 * @license MIT
 */

/**
 * Constructor for BufferQueue class.
 * @class
 * @param {number} numChannels - channel count to validate against
 *
 * @classdesc
 * Abstraction around a queue of audio buffers.
 *
 * Stuff input buffers of any length in via {@link BufferQueue#appendBuffer},
 * check how much is queued with {@link BufferQueue#sampleCount}, and pull out
 * data of any length from the start with {@link BufferQueue#shift}.
 */
function BufferQueue(numChannels) {
  if (numChannels < 1 || numChannels !== Math.round(numChannels)) {
    throw 'Invalid channel count for BufferQueue';
  }
  this.channels = numChannels;
  this._buffers = [];
}

/**
 * Count how many samples are queued up
 *
 * @returns {number} - total count in samples
 */
BufferQueue.prototype.sampleCount = function() {
  var count = 0;
  this._buffers.forEach(function(buffer) {
    count += buffer[0].length;
  });
  return count;
};

/**
 * Create an empty audio sample buffer with space for the given count of samples.
 *
 * @param {number} sampleCount - number of samples to reserve in the buffer
 * @returns {SampleBuffer} - empty buffer
 */
BufferQueue.prototype.createBuffer = function(sampleCount) {
  var output = [];
  for (var i = 0; i < this.channels; i++) {
    output[i] = new Float32Array(sampleCount);
  }
  return output;
};

/**
 * Validate a buffer for correct object layout
 *
 * @param {SampleBuffer} buffer - an audio buffer to check
 * @returns {boolean} - true if input buffer is valid
 */
BufferQueue.prototype.validate = function(buffer) {
  if (buffer.length !== this.channels) {
    return false;
  }

  var sampleCount;
  for (var i = 0; i < buffer.length; i++) {
    var channelData = buffer[i];
    if (!(channelData instanceof Float32Array)) {
      return false;
    }
    if (i == 0) {
      sampleCount = channelData.length;
    } else if (channelData.length !== sampleCount) {
      return false;
    }
  }

  return true;
};

/**
 * Append a buffer of input data to the queue...
 *
 * @param {SampleBuffer} buffer - an audio buffer to append
 * @throws exception on invalid input
 */
BufferQueue.prototype.appendBuffer = function(buffer) {
  if (!this.validate(buffer)) {
    throw "Invalid audio buffer passed to BufferQueue.appendBuffer";
  }
  this._buffers.push(buffer);
};

/**
 * Shift out a buffer with up to the given maximum sample count.
 * If less data is available, only the available data will be
 * returned. Call {@link BufferQueue#sampleCount} ahead of time
 * to check how many are available.
 *
 * @param {number} maxSamples - maximum count of samples to return on this call
 * @returns {SampleBuffer} - audio buffer with zero or more samples
 */
BufferQueue.prototype.shift = function(maxSamples) {
  var sampleCount = Math.min(this.sampleCount(), maxSamples | 0),
    output = this.createBuffer(sampleCount),
    input = null,
    inputSamples = 0,
    pos = 0,
    split = false,
    splitPoint = 0,
    splitBuffer = null,
    a = null,
    b = null,
    inputData = null,
    i = 0;

  while (pos < sampleCount) {
    input = this._buffers[0];
    inputSamples = input[0].length;

    // Will this input buffer overflow our maximum?
    if (pos + inputSamples > sampleCount) {
      // Yep, split it in twain and store the rest for next time.
      splitPoint = sampleCount - pos;
      a = [];
      b = [];
      for (i = 0; i < this.channels; i++) {
        a.push(input[i].subarray(0, splitPoint));
        b.push(input[i].subarray(splitPoint));
      }
      input = a;
      this._buffers[0] = b;
    } else {
      // Nope, shift it off the queue.
      this._buffers.shift()
    }

    // Copy to output...
    for (var i = 0; i < this.channels; i++) {
      inputData = input[i];
      output[i].set(inputData, pos);
    }
    pos += inputSamples;
  }

  return output;
};

module.exports = BufferQueue;
