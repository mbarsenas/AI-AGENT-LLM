import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Speak text using OpenAI TTS.
 * Zero extra dependencies.
 */
export async function speak(text, { apiKey, voice = "alloy" } = {}) {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY for TTS");
  if (!text?.trim()) return;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4096),
      voice,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI TTS error ${res.status}: ${body}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const tmpFile = join(tmpdir(), `llm-bridge-${Date.now()}.mp3`);

  try {
    await writeFile(tmpFile, buffer);
    await playAudio(tmpFile);
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}

async function playAudio(file) {
  const platform = process.platform;

  if (platform === "darwin") {
    await execFileAsync("afplay", [file]);
  } else if (platform === "win32") {
    // Create a temporary VBS that plays the file with Windows Media Player and waits
    const vbsContent = `
Set Sound = CreateObject("WMPlayer.OCX.7")
Sound.URL = "${file.replace(/\\/g, "\\\\")}"
Sound.settings.volume = 100
Sound.controls.play
Do While Sound.playState <> 1
  WScript.Sleep 150
Loop
Sound.close
`;

    const vbsFile = join(tmpdir(), `llm-bridge-play-${Date.now()}.vbs`);
    await writeFile(vbsFile, vbsContent);

    try {
      await execFileAsync("cscript", ["//nologo", vbsFile]);
    } finally {
      unlink(vbsFile).catch(() => {});
    }
  } else {
    // Linux
    const players = [
      ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", file]],
      ["mpv", ["--no-video", "--really-quiet", file]],
      ["mpg123", ["-q", file]],
    ];

    let lastError;
    for (const [cmd, args] of players) {
      try {
        await execFileAsync(cmd, args);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`No audio player found. Last error: ${lastError?.message}`);
  }
}