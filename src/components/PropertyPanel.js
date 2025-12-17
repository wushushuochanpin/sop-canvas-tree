import React from "react";
import { Form, Card, Input, Select, Button, Space, Typography } from "antd";
import {
  SaveOutlined,
  FileTextOutlined,
  CloseOutlined,
} from "@ant-design/icons";

const { Text } = Typography;
const { Option } = Select;

const PropertyPanel = ({
  form,
  currentEditNode,
  jumpTargets,
  onSaveNode,
  onSaveDraft,
  onClose,
}) => {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <Text strong>属性配置</Text>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <div style={{ minWidth: 300 }}>
          {currentEditNode && (
            <Form
              form={form}
              layout="vertical"
              onFinish={onSaveNode}
              size="small"
            >
              <Card size="small" title="基础信息" style={{ marginBottom: 12 }}>
                <Form.Item label="节点 ID" name="id">
                  <Input disabled style={{ fontSize: 11, color: "#888" }} />
                </Form.Item>
                <Form.Item
                  label="名称"
                  name="name"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="名称" />
                </Form.Item>
              </Card>
              <Card size="small" title="流程" style={{ marginBottom: 12 }}>
                <Form.Item name="targetNodeId" label="跳转至">
                  <Select allowClear showSearch optionFilterProp="children">
                    {jumpTargets.map((n) => (
                      <Option key={n.id} value={n.id}>
                        <span
                          style={{
                            color: "#1890ff",
                            fontWeight: "bold",
                            marginRight: 8,
                          }}
                        >
                          {n.computedCode}
                        </span>
                        {n.data.label || "(未命名)"}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Card>
              <Card size="small" title="随路数据" style={{ marginBottom: 12 }}>
                <div
                  style={{
                    background: "#fafafa",
                    padding: 8,
                    borderRadius: 4,
                    maxHeight: 120,
                    overflowY: "auto",
                    marginBottom: 8,
                    border: "1px solid #f0f0f0",
                  }}
                >
                  {Object.entries(currentEditNode.aggregatedData || {}).map(
                    ([k, v]) => (
                      <div
                        key={k}
                        style={{
                          fontSize: 10,
                          borderBottom: "1px dashed #eee",
                          padding: "2px 0",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "#1890ff" }}>{k}</span>
                        <span>{v}</span>
                      </div>
                    )
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Form.Item
                    name="payloadKey"
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input placeholder="Key" />
                  </Form.Item>
                  <Form.Item
                    name="payloadValue"
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input placeholder="Value" />
                  </Form.Item>
                </div>
              </Card>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  block
                >
                  保存
                </Button>
                <Button
                  icon={<FileTextOutlined />}
                  block
                  onClick={onSaveDraft}
                  style={{
                    borderStyle: "dashed",
                    borderColor: "#faad14",
                    color: "#faad14",
                  }}
                >
                  草稿
                </Button>
              </Space>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;
