# ZENNER LoRa Radio Packet Decoder

JavaScript payload decoder for **ZENNER LoRa** devices, implementing the full **LoRa Radio Packet Definitions v1.35** (2025-11-14) specification.

Compatible with:

- **ChirpStack** v3 and v4
- **The Things Network** (TTN) v2 and v3 / The Things Stack

## Supported Packet Types

| Packet Type | Name | Description |
|-------------|------|-------------|
| 0x00 | SP0 | Current value |
| 0x01 | SP1 | Day value, single channel |
| 0x02 | SP2 | Monthly value, single channel |
| 0x03 | SP3 | Monthly and half-monthly value, single channel |
| 0x04 | SP4 | Key date and value at key date, single channel |
| 0x05 | SP5 | Day value, two channels |
| 0x06 | SP6 | Monthly value, two channels |
| 0x07 | SP7 | Monthly and half-monthly value, two channels |
| 0x08 | SP8 | Key date and value at key date, two channels |
| 0x09 | SP9 | Device info / time / status (subtypes 0x00–0x03) |
| 0x0A | AP1 | Asynchronous status and event notifications |
| 0x0B | AP2 | Configuration change (split devices) |
| 0x0C | SP12 | Hourly values, one packet per channel |
| 0x0D | SP13 | 15-minute values, one packet per channel |

## Subtype Definitions (SP1–SP8, SP12)

| Subtype | Encoding | Notes |
|---------|----------|-------|
| 0x00 | BCD coded integer | No decimal point; physical unit from SP9.3 |
| 0x01 | Binary, unit scale | Heat cost allocators (HCA) |
| 0x02 | Binary, product scale | Heat cost allocators (HCA) |
| 0x03 | Split 2×16-bit binary | Two channels in a single 4-byte field |
| 0x04 | Bucket | Temperature & humidity sensors |
| 0x05 | Channel 1 binary + Channel 2 timestamp | — |

## Status Codes (AP1 Events)

All 20+ status codes from section 4.2.1 are decoded, including tamper, removal, leak, reverse installation, battery warning/EOL/prewarning, oversized, undersized, no consumption, burst, dry, frost, backflow, smoke alarms, and communication adapter events.

## Installation

### ChirpStack v4

1. Go to **Device Profiles → <your profile> → Codec**
2. Select **JavaScript**
3. Paste the contents of `zenner_lora_decoder.js`

### ChirpStack v3

Uses the `Decode(fPort, bytes)` entry point included in `zenner_lora_decoder.js`.

### The Things Network v3 / The Things Stack

1. Go to **Applications → <your app> → Payload formatters → Uplink**
2. Set Formatter type to **JavaScript**
3. Paste the contents of `zenner_lora_decoder_ttn.js`

### The Things Network v2 (legacy)

Uses the `Decoder(bytes, port)` entry point included in `zenner_lora_decoder_ttn.js`.

## Implementation Notes

- **Byte order**: LSB first (little-endian) as specified in v1.35. Previous versions of the spec listed MSB, but all ZENNER devices have always used LSB.
- **Unknown values**: Fields filled with `0xFF` in every byte are returned as `null`, per section 2.2.
- **Date encoding**: Follows EN 13757-3:2013, Annex A — Type G (CP16, 2-byte date) and Type F (CP32, 4-byte date+time).
- **SP9 subtypes**: Unlike SP1–SP8 where the subtype defines the value encoding, SP9 subtypes (0x00–0x03) select entirely different packet layouts.
- **Status summary**: Returned as raw bytes since interpretation is device-type specific.

## Example Output

Payload `1199220000` on fPort 1:

```json
{
  "packet_type": 1,
  "subtype": 1,
  "packet_name": "SP1",
  "description": "Day value (single channel)",
  "day_value": 8857
}
```

Payload with SP2 monthly value:

```json
{
  "packet_type": 2,
  "subtype": 1,
  "packet_name": "SP2",
  "description": "Monthly value (single channel)",
  "device_datetime": {
    "year": 2026,
    "month": 3,
    "day": 20,
    "hour": 14,
    "minute": 30,
    "summer_time": false,
    "invalid": false,
    "iso": "2026-03-20T14:30:00"
  },
  "monthly_value": 1000,
  "status_summary": {
    "raw": "0xBBAA",
    "byte_0": 170,
    "byte_1": 187
  }
}
```

## Reference

Based on **ZENNER LoRa Radio Packet Definitions v1.35** (2025-11-14), authored by ZENNER International GmbH & Co. KG.

## License
 
Apache License 2.0 — see [LICENSE](LICENSE) for details.
