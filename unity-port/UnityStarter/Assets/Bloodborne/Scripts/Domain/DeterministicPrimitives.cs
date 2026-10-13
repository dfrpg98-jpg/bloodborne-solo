using System;
using System.Collections.Generic;

namespace Bloodborne.Port.Domain
{
    // Deliberately independent of UnityEngine: usable in a headless parity runner.
    public sealed class DeterministicRandom
    {
        public uint State { get; private set; }
        public DeterministicRandom(uint rawState) { State = rawState; }
        public static uint MixSeed(uint seed)
        {
            unchecked
            {
                uint x = seed == 0 ? 1u : seed;
                x = (x ^ (x >> 16)) * 0x85ebca6bu;
                x = (x ^ (x >> 13)) * 0xc2b2ae35u;
                x ^= x >> 16;
                return x == 0 ? 1u : x;
            }
        }
        public double Next()
        {
            unchecked
            {
                uint x = State;
                x ^= x << 13; x ^= x >> 17; x ^= x << 5;
                State = x;
                return State / 4294967296.0;
            }
        }
        public void Shuffle<T>(IList<T> items)
        {
            for (int i = items.Count - 1; i > 0; i--)
            {
                int j = (int)Math.Floor(Next() * (i + 1));
                T old = items[i]; items[i] = items[j]; items[j] = old;
            }
        }
    }
    public struct TilePoint
    {
        public readonly double X, Y;
        public TilePoint(double x, double y) { X = x; Y = y; }
    }
    public static class TileCoordinates
    {
        // Same y-down tile-percent frame as tile-geometry.js. Conversion to
        // Unity y-up happens only in the presentation adapter after rotation.
        public static TilePoint Rotate(TilePoint point, int quarterTurns)
        {
            int turns = ((quarterTurns % 4) + 4) % 4;
            while (turns-- > 0) point = new TilePoint(100 - point.Y, point.X);
            return point;
        }
        public static TilePoint UnityLocal(TilePoint point, double tileWorldSize)
        {
            if (tileWorldSize <= 0 || Double.IsInfinity(tileWorldSize) || Double.IsNaN(tileWorldSize))
                throw new ArgumentOutOfRangeException("tileWorldSize");
            return new TilePoint((point.X / 100 - .5) * tileWorldSize, (.5 - point.Y / 100) * tileWorldSize);
        }
    }
}
