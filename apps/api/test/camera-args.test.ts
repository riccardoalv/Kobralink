import { describe, expect, it } from 'bun:test';
import { cameraFfmpegArgs } from '../src/bridge/camera';

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('cameraFfmpegArgs', () => {
    it('keeps the native resolution and frame rate of the camera for the MJPEG stream', () => {
        const args = cameraFfmpegArgs('http://printer:18088/flv');
        expect(after(args, '-vsync')).toBe('passthrough');
        expect(args).not.toContain('-vf');
        expect(args.join(' ')).not.toContain('scale=');
        expect(after(args, '-vcodec')).toBe('mjpeg');
        expect(after(args, '-q:v')).toBe('2');
        expect(args).toContain('pipe:1');
    });

    it('copies the original H.264 to the MPEG-TS pipe', () => {
        const args = cameraFfmpegArgs('http://printer:18088/flv');
        const ts = args.slice(args.indexOf('pipe:1') + 1);
        expect(after(ts, '-c:v')).toBe('copy');
        expect(ts).toContain('-an');
        expect(after(ts, '-f')).toBe('mpegts');
        expect(ts[ts.length - 1]).toBe('pipe:3');
    });

    it('reads an HTTP source with wall-clock timestamps', () => {
        const args = cameraFfmpegArgs('http://printer:18088/flv');
        expect(after(args, '-i')).toBe('http://printer:18088/flv');
        expect(after(args, '-use_wallclock_as_timestamps')).toBe('1');
        expect(args).not.toContain('-rtsp_transport');
    });

    it('reads an RTSP source over TCP with a minimal probe', () => {
        const args = cameraFfmpegArgs('RTSP://printer/live');
        expect(after(args, '-rtsp_transport')).toBe('tcp');
        expect(after(args, '-probesize')).toBe('32');
        expect(args).not.toContain('-use_wallclock_as_timestamps');
    });
});
