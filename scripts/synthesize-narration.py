"""Local optional media tool: eSpeak PCM plus its own word/sentence timestamps.

Uses the public eSpeak NG 1.51 C API, not a language model or speech recognizer:
https://github.com/espeak-ng/espeak-ng/blob/1.51/src/include/espeak-ng/speak_lib.h
The separately installed eSpeak library is not bundled in the app/source export.
"""
import ctypes as c
import ctypes.util
import json
import os
from pathlib import Path
import sys
import wave


class EventValue(c.Union):
    _fields_ = [("number", c.c_int), ("name", c.c_char_p), ("phoneme", c.c_char * 8)]


class SpeechEvent(c.Structure):
    _fields_ = [
        ("type", c.c_int), ("identifier", c.c_uint), ("text_position", c.c_int),
        ("length", c.c_int), ("audio_position", c.c_int), ("sample", c.c_int),
        ("user_data", c.c_void_p), ("value", EventValue),
    ]


def media_path(value):
    path = Path(value).resolve()
    if not path.is_relative_to(Path("work/demo").resolve()):
        raise ValueError("Narration inputs and outputs must stay under work/demo.")
    return path


def main():
    if len(sys.argv) != 4:
        raise ValueError("Usage: synthesize-narration.py INPUT.txt OUTPUT.wav EVENTS.json")
    source, audio, metadata = map(media_path, sys.argv[1:])
    text = source.read_text(encoding="utf-8")
    if not text.strip() or len(text) > 10000:
        raise ValueError("Narration must contain 1–10,000 characters.")
    library = os.environ.get("ESPEAK_LIBRARY") or ctypes.util.find_library("espeak-ng")
    if not library:
        raise RuntimeError("Install the optional eSpeak NG library or set ESPEAK_LIBRARY.")
    lib = c.CDLL(library)
    callback_type = c.CFUNCTYPE(c.c_int, c.POINTER(c.c_short), c.c_int, c.POINTER(SpeechEvent))
    lib.espeak_Initialize.argtypes = [c.c_int, c.c_int, c.c_char_p, c.c_int]
    lib.espeak_Initialize.restype = c.c_int
    lib.espeak_SetSynthCallback.argtypes = [callback_type]
    lib.espeak_SetSynthCallback.restype = None
    lib.espeak_SetVoiceByName.argtypes = [c.c_char_p]
    lib.espeak_SetVoiceByName.restype = c.c_int
    lib.espeak_SetParameter.argtypes = [c.c_int, c.c_int, c.c_int]
    lib.espeak_SetParameter.restype = c.c_int
    lib.espeak_Synth.argtypes = [c.c_void_p, c.c_size_t, c.c_uint, c.c_int,
                                c.c_uint, c.c_uint, c.POINTER(c.c_uint), c.c_void_p]
    lib.espeak_Synth.restype = c.c_int
    lib.espeak_Info.argtypes = [c.POINTER(c.c_char_p)]
    lib.espeak_Info.restype = c.c_char_p
    lib.espeak_Terminate.argtypes = []
    lib.espeak_Terminate.restype = c.c_int
    data = os.environ.get("ESPEAK_DATA_DIR")
    # Mode 2 is synchronous retrieval, never speaker playback. DONT_EXIT lets
    # a missing data directory become an ordinary error instead of process exit.
    rate = lib.espeak_Initialize(2, 0, os.fsencode(data) if data else None, 0x8000)
    if rate <= 0:
        raise RuntimeError("eSpeak could not initialize its local voice data.")
    chunks, events, callback_errors = [], [], []

    @callback_type
    def capture(samples, count, emitted):
        try:
            if samples and count:
                if count < 0 or count > rate * 10:
                    raise RuntimeError("Unexpected eSpeak audio buffer size.")
                chunks.append(c.string_at(samples, count * 2))
            for index in range(10000):
                event = emitted[index]
                if event.type == 0:
                    break
                if event.type in (1, 2, 5):
                    events.append({
                        "type": {1: "word", 2: "sentence", 5: "clause-end"}[event.type],
                        "textPosition": event.text_position,
                        "length": event.length,
                        "audioMs": event.audio_position,
                    })
            else:
                raise RuntimeError("Unterminated eSpeak event list.")
            return 0
        except Exception as error:
            callback_errors.append(str(error))
            return 1

    try:
        lib.espeak_SetSynthCallback(capture)
        if lib.espeak_SetVoiceByName(b"en-us") != 0:
            raise RuntimeError("The en-us eSpeak voice is unavailable.")
        for parameter, value in [(1, 160), (3, 45)]:
            if lib.espeak_SetParameter(parameter, value, 0) != 0:
                raise RuntimeError("eSpeak rejected a narration parameter.")
        encoded = text.encode("utf-8") + b"\0"
        buffer = c.create_string_buffer(encoded)
        identifier = c.c_uint()
        # UTF-8 plain text plus a final pause; SSML and external audio are off.
        result = lib.espeak_Synth(buffer, len(encoded), 0, 1, 0, 1 | 0x1000,
                                  c.byref(identifier), None)
        if result != 0 or callback_errors:
            raise RuntimeError("eSpeak synthesis failed: " + "; ".join(callback_errors))
        pcm = b"".join(chunks)
        words = [event for event in events if event["type"] == "word"]
        if not pcm or not words:
            raise RuntimeError("Synthesis did not produce both audio and word events.")
        seconds = len(pcm) / 2 / rate
        if any(not 0 <= word["audioMs"] <= seconds * 1000 for word in words):
            raise RuntimeError("Word timing escaped its generated audio.")
        if any(left["audioMs"] > right["audioMs"] for left, right in zip(words, words[1:])):
            raise RuntimeError("Word timestamps are not monotonic.")
        if sys.byteorder != "little":
            from array import array
            samples = array("h", pcm)
            samples.byteswap()
            pcm = samples.tobytes()
        audio.parent.mkdir(parents=True, exist_ok=True)
        metadata.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(audio), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(rate)
            output.writeframes(pcm)
        report = {
            "engine": "eSpeak NG " + lib.espeak_Info(None).decode("utf-8"),
            "voice": "en-us", "wordsPerMinute": 160, "pitch": 45,
            "sampleRate": rate, "durationSeconds": seconds,
            "timingSource": "Engine word-event timestamps, not recognition or human listening",
            "events": events,
        }
        metadata.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"engine": report["engine"], "seconds": seconds, "wordEvents": len(words)}))
    finally:
        lib.espeak_Terminate()


if __name__ == "__main__":
    main()
