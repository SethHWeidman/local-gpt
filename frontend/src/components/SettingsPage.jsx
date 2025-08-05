import { useState, useEffect } from "react";
import api from "../api";
import "./SettingsPage.css";

/**
 * SettingsPage
 *
 * Allows users to view and update their OpenAI and Anthropic API keys.
 */
const SettingsPage = ({ onClose }) => {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadKeys() {
      try {
        const keys = await api.getUserSettings();
        setOpenaiKey(keys.openai_api_key || "");
        setAnthropicKey(keys.anthropic_api_key || "");
      } catch (e) {
        console.error("Failed to load user settings:", e);
      }
    }
    loadKeys();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateUserSettings({
        openai_api_key: openaiKey,
        anthropic_api_key: anthropicKey,
      });
      onClose();
    } catch (e) {
      console.error("Failed to save settings:", e);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <h2>User Settings</h2>
      <div className="settings-field">
        <label>OpenAI API Key:</label>
        <input
          type="password"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder="sk-..."
        />
        {openaiKey && <span className="settings-ok">✓ Key set</span>}
      </div>
      <div className="settings-field">
        <label>Anthropic API Key:</label>
        <input
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="sk-..."
        />
        {anthropicKey && <span className="settings-ok">✓ Key set</span>}
      </div>
      {error && <div className="settings-error">{error}</div>}
      <div className="settings-actions">
        <button onClick={handleSave} disabled={saving}>
          Save
        </button>
        <button onClick={onClose} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
