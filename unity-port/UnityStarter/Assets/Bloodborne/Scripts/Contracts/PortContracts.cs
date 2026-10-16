using System;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bloodborne.Port.Contracts
{
    // Open payloads intentionally preserve absent/null and existing choice data.
    // Replacing these with enums requires a rules-version migration, not a DTO edit.
    public sealed class ContentPackage
    {
        [JsonProperty("format")] public string Format;
        [JsonProperty("schemaVersion")] public int SchemaVersion;
        [JsonProperty("sourceGameVersion")] public string SourceGameVersion;
        [JsonProperty("sourceCommit")] public string SourceCommit;
        [JsonProperty("currentRulesVersion")] public int CurrentRulesVersion;
        [JsonProperty("supportedReplayRulesVersions")] public JArray ReplayRulesVersions;
        [JsonProperty("visibility")] public string Visibility;
        [JsonProperty("modules")] public JObject Modules;
        [JsonProperty("campaign")] public JObject Campaign;
        [JsonProperty("weaponVisuals")] public JObject WeaponVisuals;
        [JsonProperty("tileGeometry")] public JObject TileGeometry;
    }
    public sealed class SaveCandidate
    {
        public readonly JObject Envelope;
        public SaveCandidate(JObject envelope) { Envelope = (JObject)envelope.DeepClone(); }
        // This class is explicitly an unverified candidate, never loaded gameplay.
    }
    public sealed class PublicFrame
    {
        public readonly JObject View;
        public readonly JArray Actions;
        public PublicFrame(JObject view, JArray actions)
        {
            PortJson.ValidatePublicView(view);
            View = (JObject)view.DeepClone(); Actions = (JArray)actions.DeepClone();
        }
    }
    public interface IPlayableRulesBridge
    {
        PublicFrame Create(JObject setup);
        PublicFrame Dispatch(int expectedRevision, JArray orderedOriginalCommands);
        // Treat saves as opaque text in the presentation. A reducer must replay
        // and assert the entire state before accepting it, then record adoptions.
        PublicFrame ImportSave(string opaqueSave);
        string ExportSave();
    }
    // Only headless development parity code receives private state.
    public interface IDevelopmentParityEngine
    {
        void Create(JObject setup);
        void Dispatch(JObject originalCommand);
        JObject AuthoritativeState { get; }
        JObject ProjectPublicView();
    }
    public static class PortJson
    {
        public static JObject ReadObject(string text)
        {
            // Unity JsonUtility cannot represent the dictionaries and arbitrary
            // nested command choices in these original saves without data loss.
            // Date inference changes accepted command strings and their saved
            // offsets. Preserve every JSON string literally for exact replay.
            using (StringReader input = new StringReader(text))
            using (JsonTextReader reader = new JsonTextReader(input) { DateParseHandling = DateParseHandling.None })
            {
                JObject root = JObject.Load(reader, new JsonLoadSettings { DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error });
                // JObject.Load reads one value. Keep JObject.Parse's rejection
                // of trailing values instead of silently accepting a prefix.
                while (reader.Read())
                    if (reader.TokenType != JsonToken.Comment) throw new JsonReaderException("Additional JSON content after object.");
                return root;
            }
        }
        public static ContentPackage ReadContent(string text)
        {
            JObject root = ReadObject(text);
            if ((string)root["format"] != "bloodborne-unity-content" || (int?)root["schemaVersion"] != 1 ||
                (string)root["visibility"] != "authoritative-private") throw new FormatException("Unsupported private content package.");
            ContentPackage result = root.ToObject<ContentPackage>();
            if (result.Modules == null || result.Campaign == null || result.TileGeometry == null || result.WeaponVisuals == null ||
                result.ReplayRulesVersions == null || result.CurrentRulesVersion < 7) throw new FormatException("Incomplete content package.");
            return result;
        }
        public static SaveCandidate ParseSaveForReplay(string text)
        {
            // Exact source limit: UTF-16 string length, strictly less than 2M.
            if (text == null || text.Length >= 2000000) throw new FormatException("Save exceeds source limit.");
            JObject root = ReadObject(text);
            JObject state = root["state"] as JObject;
            if ((string)root["format"] != "bloodborne-hunt-save" || (int?)root["version"] != 1 || state == null ||
                !(state["commands"] is JArray)) throw new FormatException("Unsupported save envelope.");
            return new SaveCandidate(root);
        }
        public static void ValidatePublicView(JObject root)
        {
            if (root == null || (string)root["format"] != "bloodborne-public-view" || (int?)root["version"] != 1)
                throw new FormatException("Unsupported public view.");
            string[] allowed = {"format","version","sceneId","revision","phase","result","round","track","firearmReady","hunter",
                "tiles","nodes","edges","actors","events","combat","weaponShot","firearmEntry","chapter","rewards","reactionActions"};
            foreach (JProperty property in root.Properties())
                if (Array.IndexOf(allowed, property.Name) < 0) throw new FormatException("Unapproved public field: " + property.Name);
            RejectPrivateKeys(root);
        }
        private static void RejectPrivateKeys(JToken token)
        {
            string[] blocked = {"rng","initialSeed","setup","commands","world","deck","draw","enemyDeck","enemyDiscard",
                "upgradeDeck","tileDeck","consumableDeck","market","sourceState","pendingRewards","bossDecks","chapelArrival"};
            JObject item = token as JObject;
            if (item != null) foreach (JProperty property in item.Properties())
            {
                if (Array.IndexOf(blocked, property.Name) >= 0) throw new FormatException("Private field in public payload: " + property.Name);
                RejectPrivateKeys(property.Value);
            }
            JArray list = token as JArray;
            if (list != null) foreach (JToken child in list) RejectPrivateKeys(child);
        }
    }
}
