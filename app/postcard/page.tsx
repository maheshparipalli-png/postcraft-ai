    const closingLines = wrapText(closing, 34);
    const textColor = backgroundId === "dark" ? "#ffffff" : "#171717";
    const mutedColor = backgroundId === "dark" ? "#b9b9b9" : "#777";

    const avatar = photo
      ? `<image href="${escapeXml(photo)}" x="64" y="62" width="104" height="104" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
      : `<circle cx="116" cy="114" r="52" fill="#171717"/><text x="116" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" fill="white">${escapeXml(initials)}</text>`;

    const textLines = (lines: string[], x: number, y: number, size: number, weight = 400, gap = size * 1.28) =>
      lines.map((line, index) =>
        `<text x="${x}" y="${y + index * gap}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${textColor}">${line}</text>`
      ).join("");

    let content = "";
    if (template === "stat") {
      content = `
        <text x="64" y="285" font-family="Arial,sans-serif" font-size="128" font-weight="700" fill="${textColor}">${safeStat}</text>
        ${textLines(wrapText(statLabel, 31), 68, 395, 34, 400, 47)}
        ${textLines(wrapText(closing, 38), 68, 590, 30, 400, 41)}
      `;
    } else {
      const headlineY = template === "editorial" ? 300 : 245;
      const headlineSize = template === "editorial" ? 58 : 62;
      const headlineGap = template === "editorial" ? 68 : 73;
      const bodyY = headlineY + headlineLines.length * headlineGap + 42;
      content = `
        ${textLines(headlineLines, 68, headlineY, headlineSize, 500, headlineGap)}
        ${textLines(bodyLines, 68, bodyY, 31, 400, 43)}
        ${textLines(closingLines, 68, 735, 31, 600, 42)}
      `;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 .91 0 1 0 0 .91 0 0 1 0 .89 0 0 0 .08 0"/></filter>
        <linearGradient id="gradientBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7d6c9"/><stop offset="100%" stop-color="#c9d8ff"/></linearGradient>
        <linearGradient id="photoBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8d3df"/><stop offset="100%" stop-color="#7896a0"/></linearGradient>
        <clipPath id="avatarClip"><circle cx="116" cy="114" r="52"/></clipPath>
      </defs>
      ${backgroundId === "dark"
        ? '<rect width="1080" height="1080" fill="#151515"/><circle cx="900" cy="120" r="260" fill="#2a2a2a" opacity=".65"/>'
        : backgroundId === "gradient"
          ? '<rect width="1080" height="1080" fill="url(#gradientBg)"/>'
          : backgroundId === "photo"