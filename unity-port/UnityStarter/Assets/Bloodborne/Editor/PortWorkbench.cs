using System;
using System.IO;
using Bloodborne.Port.Contracts;
using UnityEditor;
using UnityEngine;

namespace Bloodborne.Port.Editor
{
    // Import inspection is editor-only. It neither copies hidden missions into
    // UI resources nor generates a pretend working gameplay implementation.
    public static class PortWorkbench
    {
        [MenuItem("Bloodborne Port/Validate private content package")]
        private static void InspectContent()
        {
            string file = EditorUtility.OpenFilePanel("Versioned private content", "", "json");
            if (String.IsNullOrEmpty(file)) return;
            ContentPackage content = PortJson.ReadContent(File.ReadAllText(file));
            Debug.Log("Bloodborne source " + content.SourceGameVersion + "; current rules " + content.CurrentRulesVersion +
                "; " + content.TileGeometry.Count + " tiles, " + content.WeaponVisuals.Count + " weapons. Private content remains outside Assets.");
        }
        [MenuItem("Bloodborne Port/Inspect save candidate")]
        private static void InspectSave()
        {
            string file = EditorUtility.OpenFilePanel("Save for replay validation", "", "json");
            if (String.IsNullOrEmpty(file)) return;
            PortJson.ParseSaveForReplay(File.ReadAllText(file));
            Debug.Log("Save envelope parsed. Exact reducer replay is still required before gameplay import.");
        }
    }
}
