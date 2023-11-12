import * as satellite from 'satellite.js';
import { Observer } from './observer';
import { earthRadius } from './map';


export class Satellite {

    satelliteRecord: satellite.SatRec;
    audio: AudioBuffer;

    antennaPowerW: number;
    frequencyMhz: number;

    constructor(tle1: string, tle2: string, audio: AudioBuffer, antennaPowerW: number, frequencyMhz: number) {
        this.satelliteRecord = satellite.twoline2satrec(tle1, tle2);
        this.audio = audio;
        this.antennaPowerW = antennaPowerW;
        this.frequencyMhz = frequencyMhz;
    }

    getLookAngles(time: Date, observer: Observer): satellite.LookAngles | null {
        const posAndVelocity = satellite.propagate(this.satelliteRecord, time);
        if (!(posAndVelocity.position instanceof Object)) {
            return null;
        }

        const positionEcf = satellite.eciToEcf(posAndVelocity.position, satellite.gstime(time))

        return satellite.ecfToLookAngles(
            {
                height: 0,
                latitude: satellite.degreesToRadians(observer.latitude),
                longitude: satellite.degreesToRadians(observer.longitude)
            },
            positionEcf
        )
    }

    getSample(time: Date, signalLengthMs: number): Float32Array {

        let sampleStartSec = (time.getTime() / 1000) % this.audio.duration;
        let sampleEndSec = sampleStartSec + signalLengthMs / 1000;

        const part1 = this.audio.getChannelData(0).subarray(
            this.audio.sampleRate * sampleStartSec,
            this.audio.sampleRate * sampleEndSec
        )
        
        if (part1.length < this.audio.sampleRate) {
            return part1;
        }

        // wrap around
        const res = new Float32Array(this.audio.sampleRate * signalLengthMs / 1000);
        res.set(part1)
        res.set(this.audio.getChannelData(0).subarray(0, res.length - part1.length), part1.length);
        return res;
    }

    getSatPos(time: Date): [number, number] | null {
        const positionEci = satellite.propagate(this.satelliteRecord, time);
        if (!(positionEci.position instanceof Object)) {
            return null;
        }

        const positionGd = satellite.eciToGeodetic(
            positionEci.position,
            satellite.gstime(time)
        );
        return [satellite.degreesLat(positionGd.latitude), satellite.degreesLong(positionGd.longitude)];
    }

    getElevation(time: Date): number | null {
        const positionEci = satellite.propagate(this.satelliteRecord, time);
        if (!(positionEci.position instanceof Object)) {
            return null;
        }
        return Math.sqrt(
            positionEci.position.x * positionEci.position.x +
            positionEci.position.y * positionEci.position.y +
            positionEci.position.z * positionEci.position.z) - earthRadius;
    }
}
