import React, { useEffect, useRef } from "react";
import { DragOutlined } from "@ant-design/icons";

const Resizer = ({ onResize }) => {
  const isResizing = useRef(false);
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      onResize(e.movementX);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "default";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize]);
  return (
    <div
      onMouseDown={() => {
        isResizing.current = true;
        document.body.style.cursor = "col-resize";
      }}
      style={{
        width: 6,
        cursor: "col-resize",
        background: "#f5f5f5",
        borderLeft: "1px solid #e8e8e8",
        borderRight: "1px solid #e8e8e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}
    >
      <DragOutlined
        style={{ fontSize: 8, color: "#bfbfbf", transform: "rotate(90deg)" }}
      />
    </div>
  );
};

export default Resizer;
