import "./styles.css";

const App = document.getElementById("app");
const nf = Intl.NumberFormat();
const startTime = performance.now();

function log(...options) {
  const time = performance.now() - startTime;
  if (App) {
    const p = document.createElement("p");
    p.innerText = `${nf.format(time)}\n${options
      .map((option) => {
        const str = option.toString();
        if (str === "[object Object]") {
          return JSON.stringify(option, null, "\t");
        }
        return str;
      })
      .join("\n")}`;
    App.appendChild(p);
  }
  console.log(time, ...options);
}

async function main() {
  log("start", JSON.stringify(new Date()));

  const width = 200;
  const height = 100;
  const img = new ImageData(width, height);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      img.data[(r * width + c) * 4 + 0] = Math.floor((r / height) * 255);
      img.data[(r * width + c) * 4 + 1] = Math.floor((c / width) * 255);
      img.data[(r * width + c) * 4 + 2] = 127;
      img.data[(r * width + c) * 4 + 3] = 255;
    }
  }

  const bitmap = await createImageBitmap(img);

  let keyFrames = 0;
  let deltaFrames = 0;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      if (chunk.type === "key") {
        ++keyFrames;
      } else if (chunk.type === "delta") {
        ++deltaFrames;
      }
      log("output chunk", chunk, metadata);
    },
    error: (err) => {
      console.error("encode error", err);
    },
  });

  encoder.addEventListener("dequeue", (event) => {
    log("dequeued");
  });

  const fps = 30;

  encoder.configure({
    codec: "avc1.42001f", // Baseline profile (42 00) with level 3.1 (1f)
    width,
    height,
    // latencyMode: "quality",
    // framerate: fps,
    avc: { format: "annexb" },
    // hardwareAcceleration:"prefer-software"
    // bitrate:1000000,
    // bitrate: 10000000,
  });

  for (let i = 0; i < 20; i++) {
    const frame = new VideoFrame(bitmap, {
      timestamp: ((i * 1) / fps) * 1e6,
      duration: (1 / fps) * 1e6,
    });
    await new Promise((res, rej) => {
      window.setTimeout(async () => {
        await encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
        res();
      }, 100);
    });
  }

  bitmap.close();
  log("sent frames");

  await encoder.flush();
  log("flushed", { keyFrames, deltaFrames });
  encoder.close();
  log("closed", { keyFrames, deltaFrames });
  log("end", JSON.stringify(new Date()));
}

main().catch((e) => log(e, e.message));
