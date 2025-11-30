const NodeMediaServer = require('node-media-server');

const config = {
    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60,
        hostname: '127.0.0.1' // Comment out if you want to be able to access the streaming from any device and not just your computer
    },
    http: {
        port: 8000,
        allow_origin: '*',
        mediaroot: './media',
        webroot: './www',
        stream: {
            app: 'live',
            hls: true,
            hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
            dash: true,
            dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
        },
        hostname: '127.0.0.1' // Comment out if you want to be able to access the streaming from any device and not just your computer
    },
    trans: {
        ffmpeg: 'C:\\Users\\nicor\\ffmpeg\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe',
        tasks: [
            {
                app: 'live',
                hls: true,
                hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
                dash: true,
                dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
            }
        ]
    }
};

const nms = new NodeMediaServer(config);
nms.run();