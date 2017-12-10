

(function() {
	
	/**
	 * decompress bitmap from RLE algorithm
	 * @param	bitmap	{object} bitmap object of bitmap event of node-rdpjs
	 */
  
	function decompress (params) {
		var fName = null;
		switch (params.bitmap.bitsPerPixel) {
		case 15:
			fName = 'bitmap_decompress_15';
			break;
		case 16:
			fName = 'bitmap_decompress_16';
			break;
		case 24:
			fName = 'bitmap_decompress_24';
			break;
		case 32:
			fName = 'bitmap_decompress_32';
			break;
		default:
			throw 'invalid bitmap data format';
		}
		
    var input = new Uint8Array(params.bitmap.data);
    var inputPtr;
    if (params.inputBufferLength === input.length)
      inputPtr = params.inputBuffer;
    else {
      params.inputBuffer = Module._malloc(input.length);
      params.inputBufferLength = input.length;
      inputPtr = params.inputBuffer;
    }
    var inputHeap = new Uint8Array(Module.HEAPU8.buffer, inputPtr, input.length);
		inputHeap.set(input);
		
		var output_width = params.bitmap.destRight - params.bitmap.destLeft + 1;
		var output_height = params.bitmap.destBottom - params.bitmap.destTop + 1;
    var ouputSize = output_width * output_height * 4;
    
    var outputPtr;
    if (params.outputBufferLength === ouputSize)
      outputPtr = params.outputBuffer;
    else {
      params.inputBuffer = Module._malloc(ouputSize);
      params.outputBufferLength = ouputSize;
      outputPtr = params.outputBuffer;
    }
    
		var outputHeap = new Uint8Array(Module.HEAPU8.buffer, outputPtr, ouputSize);

		var res = Module.ccall(fName,
			'number',
			['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
			[outputHeap.byteOffset, output_width, output_height, params.bitmap.width, params.bitmap.height, inputHeap.byteOffset, input.length]
		);
		
		var output = new Uint8ClampedArray(outputHeap.buffer, outputHeap.byteOffset, ouputSize);
		return { width : output_width, height : output_height, data : output };
	}
	
	/**
	 * Un compress bitmap are reverse in y axis
	 */
	function reverse (bitmap) {
		return { width : bitmap.width, height : bitmap.height, data : new Uint8ClampedArray(bitmap.data) };
	}

	/**
	 * Canvas renderer
	 * @param canvas {canvas} use for rendering
	 */
	function Canvas(canvas) {
    this.canvas = canvas;
    this.cachedInputPtr = null;
    this.cachedInputLength = null;
    this.cachedOuputPtr = null;
    this.cachedOutputLength = null;
		this.ctx = canvas.getContext("2d");
	}
	
	Canvas.prototype = {
    free : function () {
      if (this.cachedInputPtr)
        Module._free(this.cachedInputPtr);
      if (this.cachedOuputPtr)
        Module._free(this.cachedOuputPtr);
      this.cachedInputPtr = null;
      this.cachedOuputPtr = null;
      this.cachedInputLength = 0;
      this.cachedOutputLength = 0;
    },
		/**
		 * update canvas with new bitmap
		 * @param bitmap {object}
		 */
		update : function (bitmap) {
			var output = null;
			if (bitmap.isCompress) {
        
        var params = {
          bitmap: bitmap,
          inputBuffer: this.cachedInputPtr,
          outputBuffer: this.cachedOuputPtr,
          inputBufferLength: this.cachedInputLength,
          outputBufferLength: this.cachedOuputLength
        };
        output = decompress(params);
        if (this.cachedInputLength !== params.inputBufferLength &&
          this.cachedInputPtr !== null) {
          Module._free(this.cachedInputPtr);
        }
        if (this.cachedOutputLength !== params.outputBufferLength &&
          this.cachedOuputPtr !== null) {
          Module._free(this.cachedOuputPtr);
        }
        this.cachedInputPtr = params.inputBuffer;
        this.cachedInputLength = params.inputBufferLength;
        this.cachedOuputPtr = params.outputBuffer;
        this.cachedOutputLength = params.outputBufferLength;
			}
			else {
				output = reverse(bitmap);
			}
			
			// use image data to use asm.js
			var imageData = this.ctx.createImageData(output.width, output.height);
			imageData.data.set(output.data);
			this.ctx.putImageData(imageData, bitmap.destLeft, bitmap.destTop);
		}
	}
	
	/**
	 * Module export
	 */
	Mstsc.Canvas = {
		create : function (canvas) {
			return new Canvas(canvas);
		}
	}
})();
