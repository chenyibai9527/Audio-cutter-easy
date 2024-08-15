let wavesurfer;
        let audioContext;
        let audioBuffer;
        let region;
        document.addEventListener('DOMContentLoaded', function() {
    // 创建全局AudioContext
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#00ff94',
        progressColor: '#00ff94',
        cursorColor: '#ffffff',
        barWidth: 2,
        showTime:true,
        barRadius: 0,
        cursorWidth: 1,
        height: 200,
        barGap: 3,
        plugins: [
            WaveSurfer.timeline.create({
                container: '#timeline',
                primaryColor: '#fff', // 主刻度线颜色
                secondaryColor: '#fff', // 次刻度线颜色
                primaryFontColor: '#fff', // 时间标签颜色
                secondaryFontColor: '#fff' // 次时间标签颜色
            }),
            WaveSurfer.regions.create()
        ]
    });

    wavesurfer.on('ready', function() {
        wavesurfer.clearRegions();
        region = wavesurfer.addRegion({
            start: 0,
            end: wavesurfer.getDuration(),
            color: 'rgba(30, 29, 40, 0.5)',
            drag:true,
            resize:true,
            handle:{
                        left:{
                            width: '8px',
                            backgroundColor: '#64e1c6'
                        },
                        right:{
                            width: '8px',
                            backgroundColor: '#64e1c6'
                        },
                        
                    }
        });
        updateTimeDisplay();
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('editorSection').style.display = 'block';
        wavesurfer.drawBuffer();
        // 修改主刻度线样式
    document.querySelectorAll('.wave-timeline .timeline-tick').forEach(function(tick) {
        tick.style.borderLeftColor = '#FF5722';
        tick.style.borderLeftWidth = '2px';
    });

    // 修改次刻度线样式
    document.querySelectorAll('.wave-timeline .timeline-tick-small').forEach(function(tick) {
        tick.style.borderLeftColor = '#FF9800';
        tick.style.borderLeftWidth = '1px';
    });

    // 修改时间标签样式
    document.querySelectorAll('.wave-timeline .timeline-label').forEach(function(label) {
        label.style.color = '#2196F3';
        label.style.fontSize = '14px';
        label.style.fontWeight = 'bold';
    });
    });

    wavesurfer.on('region-updated', updateTimeDisplay);
    wavesurfer.on('play', updatePlayButton);
    wavesurfer.on('pause', updatePlayButton);
    wavesurfer.on('region-updated',function(region){
        wavesurfer.seekTo(region.start / wavesurfer.getDuration());
    });

    document.getElementById('uploadBtn').addEventListener('click', function() {
        let input = document.createElement('input');
        input.type = 'file';
        
        input.accept = 'audio/*,video/*,.mp4,.m4a,.wav,.mp3,.flac,.aac';
        input.onchange = e => {
            let file = e.target.files[0];
            loadAudioFile(file);
        }
        input.click();
    });

    document.getElementById('playBtn').addEventListener('click', function() {
        wavesurfer.playPause();
    });

    document.getElementById('trimBtn').addEventListener('click', function() {
        if (audioBuffer && region) {
            let cutBuffer = cutAudio(audioBuffer, region.start, region.end);
            audioBuffer = cutBuffer;  // 更新 audioBuffer
            wavesurfer.loadDecodedBuffer(cutBuffer);  // 使用新的 buffer 更新波形
        }
    });

    // 添加保存按钮的事件监听器
    document.getElementById('saveBtn').addEventListener('click', function() {
        if (audioBuffer) {
            let format = document.getElementById('formatSelect').value;
            if (format === 'wav') {
                let wav = audioBufferToWav(audioBuffer);
                saveFile(new Blob([wav], { type: 'audio/wav' }), 'cut_audio.wav');
            } else if (format === 'mp3') {
                audioBufferToMp3(audioBuffer, function(blob) {
                    saveFile(blob, 'cut_audio.mp3');
                });
            }
        } else {
            alert('请先上传并编辑音频文件');
        }
    });
});

function loadAudioFile(file) {
    let reader = new FileReader();
    reader.onload = function(e) {
        let arrayBuffer = e.target.result;
        convertAndLoadAudioFile(arrayBuffer, file.type);
    };
    reader.readAsArrayBuffer(file);
}

function convertAndLoadAudioFile(arrayBuffer, mimeType) {
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        // 尝试直接解码
        audioContext.decodeAudioData(arrayBuffer, function(buffer) {
            audioBuffer = buffer;
            wavesurfer.loadDecodedBuffer(buffer);
        }, function(error) {
            console.error('Error decoding audio data:', error);
            // 如果直接解码失败，则尝试转换为 .wav 格式
            convertToWav(arrayBuffer, function(wavBuffer) {
                audioContext.decodeAudioData(wavBuffer, function(buffer) {
                    audioBuffer = buffer;
                    wavesurfer.loadDecodedBuffer(buffer);
                });
            });
        });
    } else {
        console.error('Unsupported file type:', mimeType);
    }
}

function convertToWav(arrayBuffer, callback) {
    // 使用 ffmpeg.js 转换为 .wav
    ffmpeg({
        MEMFS: [{name: 'input.m4a', data: new Uint8Array(arrayBuffer)}],
        arguments: ['-i', 'input.m4a', '-f', 'wav', 'output.wav'],
        onRuntimeInitialized: () => {
            ffmpeg.run().then(() => {
                const output = ffmpeg.FS('readFile', 'output.wav');
                const wavBuffer = new Uint8Array(output.buffer);
                callback(wavBuffer.buffer);
            });
        }
    });
}

        function updateTimeDisplay() {
            document.getElementById('startTime').textContent = formatTime(region.start);
            document.getElementById('endTime').textContent = formatTime(region.end);
            document.getElementById('duration').textContent = formatTime(region.end - region.start);
        }

        function updatePlayButton() {
            let playBtn = document.getElementById('playBtn');
            if (wavesurfer.isPlaying()) {
                playBtn.textContent = '暂停';
                playBtn.classList.add('playing');
            } else {
                playBtn.textContent = '播放';
                playBtn.classList.remove('playing');
            }
        }

        function formatTime(time) {
            let minutes = Math.floor(time / 60);
            let seconds = Math.floor(time % 60);
            let milliseconds = Math.floor((time % 1) * 1000);
            return String(minutes).padStart(2, '0') + ':' +
                   String(seconds).padStart(2, '0') + '.' +
                   String(milliseconds).padStart(3, '0');
        }

        function cutAudio(buffer, start, end) {
            let length = Math.floor((end - start) * buffer.sampleRate);
            let newBuffer = audioContext.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
            
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                let oldData = buffer.getChannelData(channel);
                let newData = newBuffer.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    newData[i] = oldData[Math.floor(start * buffer.sampleRate) + i];
                }
            }
            
            return newBuffer;
        }

        function audioBufferToWav(buffer) {
            let numOfChan = buffer.numberOfChannels,
                length = buffer.length * numOfChan * 2 + 44,
                outBuffer = new ArrayBuffer(length),
                view = new DataView(outBuffer),
                channels = [], i, sample,
                offset = 0,
                pos = 0;

            // write WAVE header
            setUint32(0x46464952);                         // "RIFF"
            setUint32(length - 8);                         // file length - 8
            setUint32(0x45564157);                         // "WAVE"

            setUint32(0x20746d66);                         // "fmt " chunk
            setUint32(16);                                 // length = 16
            setUint16(1);                                  // PCM (uncompressed)
            setUint16(numOfChan);
            setUint32(buffer.sampleRate);
            setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
            setUint16(numOfChan * 2);                      // block-align
            setUint16(16);                                 // 16-bit (hardcoded in this demo)

            setUint32(0x61746164);                         // "data" - chunk
            setUint32(length - pos - 4);                   // chunk length

            // write interleaved data
            for(i = 0; i < buffer.numberOfChannels; i++)
                channels.push(buffer.getChannelData(i));

            while(pos < length) {
                for(i = 0; i < numOfChan; i++) {             // interleave channels
                    sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                    sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
                    view.setInt16(pos, sample, true);          // write 16-bit sample
                    pos += 2;
                }
                offset++; // next source sample
            }

            return outBuffer;

            function setUint16(data) {
                view.setUint16(pos, data, true);
                pos += 2;
            }

            function setUint32(data) {
                view.setUint32(pos, data, true);
                pos += 4;
            }
        }

        function audioBufferToMp3(buffer, callback) {
            const sampleRate = buffer.sampleRate;
            const numChannels = buffer.numberOfChannels;
            const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
            const mp3Data = [];

            const sampleBlockSize = 1152;
            const left = buffer.getChannelData(0);
            const right = numChannels > 1 ? buffer.getChannelData(1) : null;

            for (let i = 0; i < left.length; i += sampleBlockSize) {
                const leftChunk = left.subarray(i, i + sampleBlockSize);
                const rightChunk = right ? right.subarray(i, i + sampleBlockSize) : null;
                const mp3buf = rightChunk 
                    ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
                    : mp3encoder.encodeBuffer(leftChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }

            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            callback(blob);
        }

        function saveFile(blob, fileName) {
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
         }
