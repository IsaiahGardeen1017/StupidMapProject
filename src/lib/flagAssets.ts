const flagModules = import.meta.glob("../assets/flags/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  import: "default"
}) as Record<string, string>;

export type FlagAssetOption = {
  fileName: string;
  label: string;
  src: string;
};

function formatFlagLabel(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export const flagAssetOptions: FlagAssetOption[] = Object.entries(flagModules)
  .map(([path, src]) => {
    const fileName = path.split("/").at(-1) ?? path;
    return {
      fileName,
      label: formatFlagLabel(fileName),
      src
    };
  })
  .sort((left, right) => left.label.localeCompare(right.label));

export const flagAssetSourceByFileName = Object.fromEntries(
  flagAssetOptions.map((option) => [option.fileName, option.src])
) as Record<string, string>;
