import React from "react";
import { Form, Card, Input, Select, Button, Space, Typography, Tag } from "antd";
import { SaveOutlined, FileTextOutlined, CloseOutlined, SettingOutlined } from "@ant-design/icons";

const { Text: AntText } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PropertyPanel = ({ 
  form, 
  currentEditNode, 
  jumpTargets, 
  onSaveNode, 
  onClose,
  flowMeta, 
  onUpdateFlowMeta 
}) => {
  const isRootNode = currentEditNode?.id === "root";

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
        <AntText strong>
            {isRootNode ? "流程全局设置" : "节点属性配置"}
        </AntText>
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
              onFinish={(values) => {
                  if (isRootNode && values.flowName) {
                      onUpdateFlowMeta({ name: values.flowName });
                  }
                  onSaveNode(values);
              }}
              size="small"
            >
              {isRootNode && (
                  <Card 
                    size="small" 
                    title={<><SettingOutlined /> 全局配置</>} 
                    style={{ marginBottom: 12, background: "#f9f0ff", borderColor: "#d3adf7" }}
                    headStyle={{ color: "#722ed1" }}
                  >
                      <Form.Item label="流程 ID (唯一标识)" style={{marginBottom: 8}}>
                          <Input value={flowMeta.id} disabled style={{fontFamily:'monospace', color: '#999'}} />
                      </Form.Item>
                      <Form.Item 
                        label="流程名称" 
                        name="flowName" 
                        rules={[{ required: true, message: "请输入流程名称" }]}
                        initialValue={flowMeta.name}
                      >
                          <Input placeholder="输入业务流程名称" style={{ fontWeight: 500 }} />
                      </Form.Item>
                  </Card>
              )}

              <Card size="small" title="节点基础信息" style={{ marginBottom: 12 }}>
                <Form.Item label="序号 (Code)" style={{marginBottom: 8}}>
                    <Space>
                        <Tag color="blue">{currentEditNode.computedCode}</Tag>
                        {isRootNode && <Tag color="purple">ROOT</Tag>}
                    </Space>
                </Form.Item>
                <Form.Item
                  label="节点名称"
                  name="name"
                  rules={[{ required: true, message: "请输入节点名称" }]}
                >
                  <Input placeholder="例如：验证用户信息" />
                </Form.Item>
                
                <Form.Item label="备注说明" name="description">
                  <TextArea 
                    rows={4} 
                    placeholder="请输入详细说明..." 
                    showCount 
                    maxLength={200}
                  />
                </Form.Item>
              </Card>

              {!isRootNode && (
                  <Card size="small" title="随路数据 (Payload)" style={{ marginBottom: 12 }}>
                      <div style={{ background: "#fafafa", padding: 8, borderRadius: 4, maxHeight: 120, overflowY: "auto", marginBottom: 8, border: "1px solid #f0f0f0" }}>
                      {Object.entries(currentEditNode.aggregatedData || {}).map(([k, v]) => (
                          <div key={k} style={{ fontSize: 10, borderBottom: "1px dashed #eee", padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#1890ff" }}>{k}</span><span>{v}</span>
                          </div>
                      ))}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                      <Form.Item name="payloadKey" style={{ flex: 1, marginBottom: 0 }}><Input placeholder="Key" /></Form.Item>
                      <Form.Item name="payloadValue" style={{ flex: 1, marginBottom: 0 }}><Input placeholder="Value" /></Form.Item>
                      </div>
                  </Card>
              )}

              <Space direction="vertical" style={{ width: "100%" }}>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} block>
                  保存节点配置
                </Button>
                {/* 保存草稿：逻辑与保存一致，更新数据到内存 */}
                <Button 
                    icon={<FileTextOutlined />} 
                    block 
                    onClick={() => {
                        form.submit(); // 触发 onFinish
                    }}
                    style={{ borderStyle: "dashed", borderColor: "#faad14", color: "#faad14" }}
                >
                  保存节点草稿
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