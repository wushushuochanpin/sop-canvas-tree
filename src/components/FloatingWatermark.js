import React from "react";

const FloatingWatermark = () => {
  // --- 配置项 ---
  const text = "design by zhangjunxu";
  const width = 350; // 水印块的宽度
  const height = 200; // 水印块的高度
  const fontSize = 16;
  const color = "#000"; // 字体颜色
  const opacity = 0.08; // 透明度 (建议很淡)
  const rotate = -20; // 旋转角度

  // 1. 构建 SVG 字符串
  const svgString = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        fill="${color}" 
        opacity="${opacity}" 
        text-anchor="middle" 
        transform="rotate(${rotate}, ${width / 2}, ${height / 2})"
        style="user-select: none;"
      >
        ${text}
      </text>
    </svg>
  `;

  // 2. 转为 Base64
  const svgBase64 = `data:image/svg+xml;base64,${btoa(svgString)}`;

  return (
    <>
      <style>
        {`
          @keyframes watermarkSlide {
            0% { background-position: 0px 0px; }
            100% { background-position: ${width}px ${height}px; }
          }
        `}
      </style>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9999, // 保证在最顶层
          pointerEvents: "none", // 关键：让鼠标点击穿透，不影响下方操作
          backgroundImage: `url('${svgBase64}')`,
          backgroundRepeat: "repeat",
          // 60秒完成一次循环移动，线性匀速
          animation: "watermarkSlide 60s linear infinite",
        }}
      />
    </>
  );
};

export default FloatingWatermark;
