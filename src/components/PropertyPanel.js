import React, { useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Typography,
  Divider,
  Alert,
  Select,
  Card,
  Tooltip,
  message,
  Tag,
} from "antd";
import {
  CloseOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  NumberOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PropertyPanel = ({
  form,
  currentEditNode,
  jumpTargets,
  onNodeChange,
  onClose,
  lastSaveTime,
}) => {
  // 回显数据
  useEffect(() => {
    if (currentEditNode) {
      form.setFieldsValue({
        name: currentEditNode.data.label,
        description: currentEditNode.data.description,
        jumpTargetId: currentEditNode.data.jumpTargetId,
        payloadKey: "",
        payloadValue: "",
      });
    }
  }, [currentEditNode, form]);

  if (!currentEditNode) return null;

  const isRoot = currentEditNode.id === "root";
  // 获取序号，如果没有则显示 Root 或 ?
  const nodeCode = currentEditNode.computedCode || (isRoot ? "ROOT" : "?");

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentEditNode.id);
    message.success("ID 已复制");
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 1. 面板 Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fafafa",
        }}
      >
        <div>
          <Title level={5} style={{ margin: 0 }}>
            节点配置
          </Title>
          {lastSaveTime && (
            <Text
              type="secondary"
              style={{
                fontSize: 10,
                display: "flex",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <CheckCircleOutlined style={{ marginRight: 4 }} />
              已自动保存 {lastSaveTime.toLocaleTimeString()}
            </Text>
          )}
        </div>
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* 2. 内容区域 */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        {/* --- 核心修复：增强的信息展示卡片 (序号 + ID) --- */}
        <div
          style={{
            marginBottom: 24,
            background: "#f5f7fa",
            padding: "16px",
            borderRadius: 8,
            border: "1px solid #edf2f7",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                节点序号 (CODE)
              </div>
              <Tag
                color="geekblue"
                style={{
                  fontSize: 16,
                  padding: "4px 10px",
                  fontWeight: "bold",
                  margin: 0,
                }}
              >
                {nodeCode}
              </Tag>
            </div>
            <Tooltip title="复制完整 ID">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopyId}
                style={{ color: "#999" }}
              />
            </Tooltip>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
              唯一标识 (UUID)
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#666",
                wordBreak: "break-all",
                lineHeight: 1.4,
              }}
            >
              {currentEditNode.id}
            </div>
          </div>
        </div>

        {/* 表单区域 */}
        <Form
          form={form}
          layout="vertical"
          size="middle" // 改为 middle 稍微大一点点好点
          onValuesChange={(changedValues, allValues) => {
            onNodeChange(allValues);
          }}
        >
          <Form.Item
            label="节点名称"
            name="name"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input placeholder="请输入节点名称" style={{ fontWeight: 500 }} />
          </Form.Item>

          <Form.Item label="备注说明" name="description">
            <TextArea
              rows={4}
              placeholder="请输入详细的操作指引..."
              showCount
              maxLength={200}
            />
          </Form.Item>

          {!isRoot && (
            <Card
              size="small"
              title="逻辑跳转"
              style={{ marginBottom: 24, marginTop: 12 }}
            >
              <Form.Item
                name="jumpTargetId"
                style={{ marginBottom: 0 }}
                tooltip="设置后，流程图中会出现虚线指向目标节点"
              >
                <Select
                  placeholder="选择跳转目标节点..."
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {jumpTargets.map((node) => (
                    <Option key={node.id} value={node.id}>
                      <span
                        style={{
                          display: "inline-block",
                          background: "#e6f7ff",
                          color: "#1890ff",
                          padding: "0 6px",
                          borderRadius: 4,
                          marginRight: 8,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {node.computedCode}
                      </span>
                      {node.data.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Card>
          )}

          {!isRoot && (
            <Alert
              message="随路数据 (Payload) 请联系管理员配置"
              type="info"
              style={{ fontSize: 12, opacity: 0.8 }}
            />
          )}
        </Form>
      </div>
    </div>
  );
};

export default PropertyPanel;
