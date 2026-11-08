import { copyFile, writeFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
try {
  await copyFile(
    new URL(".env.example", root),
    new URL(".env", root),
    constants.COPYFILE_EXCL,
  );
  console.log(".env を作成しました（AIはモックモード）。");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(
    "既存の .env を保持しました。必要な設定は .env.example を参照してください。",
  );
}
await mkdir(new URL(".local/", root), { recursive: true });
await writeFile(
  new URL(".env.compose", root),
  `LOCAL_UID=${process.getuid?.() ?? 1000}\nLOCAL_GID=${process.getgid?.() ?? 1000}\n`,
);
console.log(`準備完了: ${fileURLToPath(root)}\nnpm run dev で起動できます。`);
