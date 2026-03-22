/**
 * ZENNER LoRa Radio Packet Decoder for The Things Network (TTN)
 * Compatible with: TTN v3 (The Things Stack) and TTN v2 (legacy)
 * Based on: LoRa-radio-packet-definitions v1.35 (2025-11-14)
 *
 * Packet types supported:
 *   SP0  (0x00) - Current value
 *   SP1  (0x01) - Day value, single channel
 *   SP2  (0x02) - Monthly value, single channel
 *   SP3  (0x03) - Monthly and half-monthly value, single channel
 *   SP4  (0x04) - Key date and value at key date, single channel
 *   SP5  (0x05) - Day value, two channels
 *   SP6  (0x06) - Monthly value, two channels
 *   SP7  (0x07) - Monthly and half-monthly value, two channels
 *   SP8  (0x08) - Key date and value at key date, two channels
 *   SP9  (0x09) - Device info / time / status (subtypes 0x00-0x03)
 *   SP12 (0x0C) - Hourly values
 *   SP13 (0x0D) - 15-min values
 *   AP1  (0x0A) - Asynchronous status/event
 *   AP2  (0x0B) - Configuration change
 *
 * Byte order: LSB first (little-endian) unless stated otherwise.
 *
 * IMPORTANT: This decoder is production-critical. Every field offset
 * and bit-mask has been cross-checked against the specification.
 */

// ─────────────────────────────────────────────────────────────────────
//  TTN v3 (The Things Stack) entry point
//  Paste this entire file into:
//    Applications → <your app> → Payload formatters → Uplink
//    Formatter type: "JavaScript"
//
//  TTN v3 calls decodeUplink(input) where:
//    input.bytes  = byte array of FRMPayload
//    input.fPort  = LoRaWAN fPort number
//  Must return: { data: {...}, warnings: [...], errors: [...] }
// ─────────────────────────────────────────────────────────────────────

function decodeUplink(input) {
    var bytes = input.bytes;
    var fPort = input.fPort;

    if (!bytes || bytes.length === 0) {
        return { data: {}, warnings: [], errors: ["Empty payload"] };
    }

    try {
        var decoded = decode(bytes, fPort);
        return { data: decoded, warnings: [], errors: [] };
    } catch (e) {
        return { data: {}, warnings: [], errors: [e.message || "Decode error"] };
    }
}

// ─────────────────────────────────────────────────────────────────────
//  TTN v2 (legacy) entry point
//  TTN v2 calls Decoder(bytes, port) and expects the decoded object
//  directly as return value.
// ─────────────────────────────────────────────────────────────────────

function Decoder(bytes, port) {
    return decode(bytes, port);
}

// ─────────────────────────────────────────────────────────────────────
//  Main decode logic
// ─────────────────────────────────────────────────────────────────────

function decode(bytes, fPort) {
    var result = {};

    if (bytes.length < 1) {
        result.error = "Payload too short";
        return result;
    }

    // First byte: high nibble = packet type, low nibble = subtype
    var packetType = (bytes[0] >> 4) & 0x0F;
    var subtype    =  bytes[0]       & 0x0F;

    result.packet_type = packetType;
    result.subtype     = subtype;

    switch (packetType) {
        case 0x00: // SP0 - current value
            result.packet_name = "SP0";
            decodeSP0(bytes, subtype, result);
            break;

        case 0x01: // SP1 - day value, single channel
            result.packet_name = "SP1";
            decodeSP1(bytes, subtype, result);
            break;

        case 0x02: // SP2 - monthly value, single channel
            result.packet_name = "SP2";
            decodeSP2(bytes, subtype, result);
            break;

        case 0x03: // SP3 - monthly and half-monthly, single channel
            result.packet_name = "SP3";
            decodeSP3(bytes, subtype, result);
            break;

        case 0x04: // SP4 - key date value, single channel
            result.packet_name = "SP4";
            decodeSP4(bytes, subtype, result);
            break;

        case 0x05: // SP5 - day value, two channels
            result.packet_name = "SP5";
            decodeSP5(bytes, subtype, result);
            break;

        case 0x06: // SP6 - monthly value, two channels
            result.packet_name = "SP6";
            decodeSP6(bytes, subtype, result);
            break;

        case 0x07: // SP7 - monthly and half-monthly, two channels
            result.packet_name = "SP7";
            decodeSP7(bytes, subtype, result);
            break;

        case 0x08: // SP8 - key date value, two channels
            result.packet_name = "SP8";
            decodeSP8(bytes, subtype, result);
            break;

        case 0x09: // SP9 - device info / time / status
            result.packet_name = "SP9";
            decodeSP9(bytes, subtype, result);
            break;

        case 0x0A: // AP1 - asynchronous status
            result.packet_name = "AP1";
            decodeAP1(bytes, subtype, result);
            break;

        case 0x0B: // AP2 - configuration change
            result.packet_name = "AP2";
            decodeAP2(bytes, subtype, result);
            break;

        case 0x0C: // SP12 - hourly values
            result.packet_name = "SP12";
            decodeSP12(bytes, subtype, result);
            break;

        case 0x0D: // SP13 - 15-min values
            result.packet_name = "SP13";
            decodeSP13(bytes, subtype, result);
            break;

        default:
            result.packet_name = "UNKNOWN";
            result.error = "Unknown packet type: 0x" + toHex(packetType);
            result.raw = bytesToHex(bytes);
            break;
    }

    return result;
}


// ─────────────────────────────────────────────────────────────────────
//  SP0: Current value  (packet type 0x00)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x0X
//    [1-4]  current value (4 bytes)
//    [5-16] debug data (optional, 12 bytes, device-specific)
// ─────────────────────────────────────────────────────────────────────

function decodeSP0(bytes, subtype, result) {
    result.description = "Current value";

    if (bytes.length < 5) {
        result.error = "SP0 payload too short (need >= 5 bytes, got " + bytes.length + ")";
        return;
    }

    result.current_value = decodeValue(bytes, 1, 4, subtype);

    if (bytes.length >= 17) {
        result.debug_data = bytesToHex(bytes.slice(5, 17));
    }
}


// ─────────────────────────────────────────────────────────────────────
//  SP1: Day value, single channel  (packet type 0x01)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x1X
//    [1-4]  day value (4 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP1(bytes, subtype, result) {
    result.description = "Day value (single channel)";

    if (bytes.length < 5) {
        result.error = "SP1 payload too short (need >= 5 bytes, got " + bytes.length + ")";
        return;
    }

    result.day_value = decodeValue(bytes, 1, 4, subtype);
}


// ─────────────────────────────────────────────────────────────────────
//  SP2: Monthly value, single channel  (packet type 0x02)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x2X
//    [1-4]  timestamp (current date+time of device, Type F)
//    [5-8]  monthly value (4 bytes)
//    [9-10] status summary (2 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP2(bytes, subtype, result) {
    result.description = "Monthly value (single channel)";

    if (bytes.length < 11) {
        result.error = "SP2 payload too short (need >= 11 bytes, got " + bytes.length + ")";
        return;
    }

    result.device_datetime = decodeDatetime(bytes, 1);
    result.monthly_value   = decodeValue(bytes, 5, 4, subtype);
    result.status_summary  = decodeStatusSummary(bytes, 9);
}


// ─────────────────────────────────────────────────────────────────────
//  SP3: Monthly + half-monthly value, single channel  (packet type 0x03)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x3X
//    [1-2]  date stamp (current date of device, Type G)
//    [3-6]  monthly value (4 bytes)
//    [7-10] half-monthly value (4 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP3(bytes, subtype, result) {
    result.description = "Monthly and half-monthly value (single channel)";

    if (bytes.length < 11) {
        result.error = "SP3 payload too short (need >= 11 bytes, got " + bytes.length + ")";
        return;
    }

    result.device_date         = decodeDate(bytes, 1);
    result.monthly_value       = decodeValue(bytes, 3, 4, subtype);
    result.half_monthly_value  = decodeValue(bytes, 7, 4, subtype);
}


// ─────────────────────────────────────────────────────────────────────
//  SP4: Key date value, single channel  (packet type 0x04)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x4X
//    [1-2]  date (key date, NOT current device date, Type G)
//    [3-6]  value at key date (4 bytes)
//    [7-8]  status summary (2 bytes)
//    [9-10] reserved (2 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP4(bytes, subtype, result) {
    result.description = "Key date value (single channel)";

    if (bytes.length < 9) {
        result.error = "SP4 payload too short (need >= 9 bytes, got " + bytes.length + ")";
        return;
    }

    result.key_date       = decodeDate(bytes, 1);
    result.key_value      = decodeValue(bytes, 3, 4, subtype);
    result.status_summary = decodeStatusSummary(bytes, 7);
}


// ─────────────────────────────────────────────────────────────────────
//  SP5: Day value, two channels  (packet type 0x05)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x5X
//    [1-4]  day value channel 0 (4 bytes)
//    [5-8]  day value channel 1 (4 bytes)
//    [9-10] status summary (2 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP5(bytes, subtype, result) {
    result.description = "Day value (two channels)";

    if (bytes.length < 11) {
        result.error = "SP5 payload too short (need >= 11 bytes, got " + bytes.length + ")";
        return;
    }

    result.day_value_ch0  = decodeValue(bytes, 1, 4, subtype);
    result.day_value_ch1  = decodeValue(bytes, 5, 4, subtype);
    result.status_summary = decodeStatusSummary(bytes, 9);
}


// ─────────────────────────────────────────────────────────────────────
//  SP6: Monthly value, two channels  (packet type 0x06)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x6X
//    [1-2]  date stamp (current date of device, Type G)
//    [3-6]  monthly value channel 0 (4 bytes)
//    [7-10] monthly value channel 1 (4 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP6(bytes, subtype, result) {
    result.description = "Monthly value (two channels)";

    if (bytes.length < 11) {
        result.error = "SP6 payload too short (need >= 11 bytes, got " + bytes.length + ")";
        return;
    }

    result.device_date        = decodeDate(bytes, 1);
    result.monthly_value_ch0  = decodeValue(bytes, 3, 4, subtype);
    result.monthly_value_ch1  = decodeValue(bytes, 7, 4, subtype);
}


// ─────────────────────────────────────────────────────────────────────
//  SP7: Monthly + half-monthly, two channels  (packet type 0x07)
//  Byte layout:
//    [0]     packet_type(4b) + subtype(4b) = 0x7X
//    [1-4]   monthly value channel 0 (4 bytes)
//    [5-8]   half-monthly value channel 0 (4 bytes)
//    [9-12]  monthly value channel 1 (4 bytes)
//    [13-16] half-monthly value channel 1 (4 bytes)
//  Note: NO date stamp (size constraint)
// ─────────────────────────────────────────────────────────────────────

function decodeSP7(bytes, subtype, result) {
    result.description = "Monthly and half-monthly value (two channels)";

    if (bytes.length < 17) {
        result.error = "SP7 payload too short (need >= 17 bytes, got " + bytes.length + ")";
        return;
    }

    result.monthly_value_ch0       = decodeValue(bytes, 1,  4, subtype);
    result.half_monthly_value_ch0  = decodeValue(bytes, 5,  4, subtype);
    result.monthly_value_ch1       = decodeValue(bytes, 9,  4, subtype);
    result.half_monthly_value_ch1  = decodeValue(bytes, 13, 4, subtype);
}


// ─────────────────────────────────────────────────────────────────────
//  SP8: Key date value, two channels  (packet type 0x08)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0x8X
//    [1-2]  date (key date, Type G)
//    [3-6]  value channel 0 at key date (4 bytes)
//    [7-10] value channel 1 at key date (4 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP8(bytes, subtype, result) {
    result.description = "Key date value (two channels)";

    if (bytes.length < 11) {
        result.error = "SP8 payload too short (need >= 11 bytes, got " + bytes.length + ")";
        return;
    }

    result.key_date      = decodeDate(bytes, 1);
    result.key_value_ch0 = decodeValue(bytes, 3, 4, subtype);
    result.key_value_ch1 = decodeValue(bytes, 7, 4, subtype);
}


// ─────────────────────────────────────────────────────────────────────
//  SP9: Device info / time / status  (packet type 0x09)
//  NOTE: For SP9, the subtype nibble selects completely different
//        packet layouts (0x00..0x03). This is different from SP1-SP8
//        where subtype describes the value encoding.
// ─────────────────────────────────────────────────────────────────────

function decodeSP9(bytes, subtype, result) {
    switch (subtype) {
        case 0x00:
            decodeSP9_00(bytes, result);
            break;
        case 0x01:
            decodeSP9_01(bytes, result);
            break;
        case 0x02:
            decodeSP9_02(bytes, result);
            break;
        case 0x03:
            decodeSP9_03(bytes, result);
            break;
        default:
            result.description = "SP9 unknown subtype";
            result.error = "Unknown SP9 subtype: 0x" + toHex(subtype);
            break;
    }
}

// ── SP9 subtype 0x00: Current date and time ──
//  [0]    0x90
//  [1-4]  timestamp (Type F)
function decodeSP9_00(bytes, result) {
    result.description = "Current date and time";

    if (bytes.length < 5) {
        result.error = "SP9.0 payload too short (need >= 5 bytes, got " + bytes.length + ")";
        return;
    }

    result.device_datetime = decodeDatetime(bytes, 1);
}

// ── SP9 subtype 0x01: Current date+time & status summary ──
//  [0]    0x91
//  [1-4]  timestamp (Type F)
//  [5-6]  status summary
//  [7-10] reserved
function decodeSP9_01(bytes, result) {
    result.description = "Current date/time and status summary";

    if (bytes.length < 7) {
        result.error = "SP9.1 payload too short (need >= 7 bytes, got " + bytes.length + ")";
        return;
    }

    result.device_datetime = decodeDatetime(bytes, 1);
    result.status_summary  = decodeStatusSummary(bytes, 5);
}

// ── SP9 subtype 0x02: Static device information ──
//  [0]     0x92
//  [1-4]   firmware version (4 bytes, LSB first)
//  [5-7]   LoRaWAN version (3 bytes: major, minor, revision)
//  [8-9]   radio library version (2 bytes, LSB first)
//  [10]    Minol device type (1 byte)
//  [11-14] meterID (4 bytes, LSB first)
//  [15-16] reserved (2 bytes)
function decodeSP9_02(bytes, result) {
    result.description = "Static device information";

    if (bytes.length < 15) {
        result.error = "SP9.2 payload too short (need >= 15 bytes, got " + bytes.length + ")";
        return;
    }

    // Firmware version: 4 bytes, LSB first
    var fwRaw = readUint32LE(bytes, 1);
    result.firmware_version_raw = "0x" + padHex(fwRaw, 8);
    result.firmware_major      = (fwRaw >> 24) & 0xFF;
    result.firmware_minor      = (fwRaw >> 16) & 0xFF;
    result.firmware_revision   = (fwRaw >> 12) & 0x0F;
    result.firmware_device_id  =  fwRaw        & 0x0FFF;
    result.firmware_version    = result.firmware_major + "." +
                                 result.firmware_minor + "." +
                                 result.firmware_revision;

    // LoRaWAN version: 3 bytes
    result.lorawan_version = bytes[5] + "." + bytes[6] + "." + bytes[7];

    // Radio library version: 2 bytes, LSB first
    result.radio_library_version = readUint16LE(bytes, 8);

    // Minol device type: 1 byte
    result.device_type = bytes[10];

    // MeterID: 4 bytes, LSB first (ZENNER internal, not meter serial)
    result.meter_id = readUint32LE(bytes, 11);
}

// ── SP9 subtype 0x03: Channel information (split module) ──
//  [0]     0x93
//  [1]     channel (0x00 = device itself)
//  [2-5]   fabrication number / serial number (4 bytes, BCD coded)
//  [6-7]   manufacturer (2 bytes)
//  [8]     fabrication block / generation (1 byte)
//  [9]     medium (1 byte)
//  [10]    OBIS code (1 byte, ASCII hex value)
//  [11-13] VIF/VIFE (3 bytes)
//  [14-16] reserved (3 bytes)
function decodeSP9_03(bytes, result) {
    result.description = "Channel information (split module)";

    if (bytes.length < 14) {
        result.error = "SP9.3 payload too short (need >= 14 bytes, got " + bytes.length + ")";
        return;
    }

    result.channel            = bytes[1];
    result.serial_number_bcd  = decodeBCD(bytes, 2, 4);
    result.manufacturer       = bytesToHex(bytes.slice(6, 8));
    result.fabrication_block  = bytes[8];
    result.medium             = bytes[9];
    result.obis_code          = String.fromCharCode(bytes[10]);
    result.vif_vife           = bytesToHex(bytes.slice(11, 14));
}


// ─────────────────────────────────────────────────────────────────────
//  SP12: Hourly values  (packet type 0x0C)
//  Byte layout:
//    [0]     packet_type(4b) + subtype(4b) = 0xCX
//    [1]     channel
//    [2]     number of first hour in this packet (0 = midnight)
//    [3-6]   first hour value (4 bytes)
//    [7-10]  second hour value (4 bytes)
//    [11-14] third hour value (4 bytes)
//    [15-16] reserved (2 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP12(bytes, subtype, result) {
    result.description = "Hourly values";

    if (bytes.length < 15) {
        result.error = "SP12 payload too short (need >= 15 bytes, got " + bytes.length + ")";
        return;
    }

    result.channel    = bytes[1];
    result.first_hour = bytes[2];

    result.hour_0_value = decodeValue(bytes, 3,  4, subtype);
    result.hour_1_value = decodeValue(bytes, 7,  4, subtype);
    result.hour_2_value = decodeValue(bytes, 11, 4, subtype);

    // Provide human-readable hour labels
    var h = result.first_hour;
    result.hour_0_label = padZero(h)     + ":00";
    result.hour_1_label = padZero(h + 1) + ":00";
    result.hour_2_label = padZero(h + 2) + ":00";
}


// ─────────────────────────────────────────────────────────────────────
//  SP13: 15-min values  (packet type 0x0D)
//  Byte layout:
//    [0]     packet_type(4b) + subtype(4b) = 0xDX
//    [1]     channel (0x00)
//    [2]     ordering type (0xFF)
//    [3-6]   first quarter value (4 bytes)
//    [7-10]  second quarter value (4 bytes)
//    [11-14] third quarter value (4 bytes)
//    [15-16] current value (2 bytes)
// ─────────────────────────────────────────────────────────────────────

function decodeSP13(bytes, subtype, result) {
    result.description = "15-minute values";

    if (bytes.length < 15) {
        result.error = "SP13 payload too short (need >= 15 bytes, got " + bytes.length + ")";
        return;
    }

    result.channel       = bytes[1];
    result.ordering_type = bytes[2];

    result.quarter_0_value = decodeValue(bytes, 3,  4, subtype);
    result.quarter_1_value = decodeValue(bytes, 7,  4, subtype);
    result.quarter_2_value = decodeValue(bytes, 11, 4, subtype);

    if (bytes.length >= 17) {
        result.current_value = readUint16LE(bytes, 15);
    }
}


// ─────────────────────────────────────────────────────────────────────
//  AP1: Asynchronous status packet  (packet type 0x0A)
//  Byte layout:
//    [0]   packet_type(4b) + subtype(4b) = 0xA0
//    [1]   status code
//    [2-4] status data (3 bytes, interpretation depends on status code)
// ─────────────────────────────────────────────────────────────────────

function decodeAP1(bytes, subtype, result) {
    result.description = "Asynchronous status / event";

    if (bytes.length < 5) {
        result.error = "AP1 payload too short (need >= 5 bytes, got " + bytes.length + ")";
        return;
    }

    var statusCode = bytes[1];
    result.status_code     = statusCode;
    result.status_code_hex = "0x" + toHex(statusCode);
    result.status_name     = getStatusCodeName(statusCode);
    result.status_data_raw = bytesToHex(bytes.slice(2, 5));

    // Decode status data fields based on status code
    switch (statusCode) {
        case 0x01: // tamper — byte0: bit0 (0=started,1=ended), bytes1-2: date
            result.tamper_active = (bytes[2] & 0x01) === 0;
            result.event_date   = decodeDate(bytes, 3);
            break;

        case 0x02: // removal — bytes1-2: date
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x03: // leak — byte0: channel, bytes1-2: date
            result.channel    = bytes[2];
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x04: // reverse installation — byte0: channel, bytes1-2: date
            result.channel    = bytes[2];
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x05: // battery warning — bytes1-2: value under load (mV)
            result.battery_voltage_mV = readUint16LE(bytes, 3);
            break;

        case 0x06: // oversized — byte0: channel, bytes1-2: date
            result.channel    = bytes[2];
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x07: // undersized — byte0: channel, bytes1-2: date
            result.channel    = bytes[2];
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x08: // error — device specific error code
            result.device_error_code = bytesToHex(bytes.slice(2, 5));
            break;

        case 0x09: // 1F mode — bytes1-2: date
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x0A: // NoConsumption — byte0: channel, bytes1-2: date
            result.channel    = bytes[2];
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x0B: // burst — byte0: channel, bytes1-2: date
            result.channel    = bytes[2];
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x0C: // battery EOL — bytes1-2: value under load (mV)
            result.battery_voltage_mV = readUint16LE(bytes, 3);
            break;

        case 0x0D: // dry — bytes1-2: date
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x0E: // frost — bytes1-2: date
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x0F: // backflow — bytes1-2: date
            result.event_date = decodeDate(bytes, 3);
            break;

        case 0x10: // battery prewarning — bytes1-2: value under load (mV)
            result.battery_voltage_mV = readUint16LE(bytes, 3);
            break;

        case 0x1D: // status summary (async)
            result.status_byte_0 = bytes[2];
            result.status_byte_1 = bytes[3];
            break;

        case 0x1E: // comm adapter: comm lost
            break;

        case 0x1F: // comm adapter: battery EOL — bytes1-2: value under load
            result.battery_voltage_mV = readUint16LE(bytes, 3);
            break;

        default:
            // Status data left as raw hex
            break;
    }
}


// ─────────────────────────────────────────────────────────────────────
//  AP2.0: Configuration change  (packet type 0x0B)
//  Byte layout:
//    [0]    packet_type(4b) + subtype(4b) = 0xB0
//    [1]    channel (0x00 = device itself)
//    [2-5]  fabrication number / serial number (4 bytes)
//    [6-7]  manufacturer (2 bytes)
//    [8]    fabrication block / generation (1 byte)
//    [9]    medium (1 byte)
// ─────────────────────────────────────────────────────────────────────

function decodeAP2(bytes, subtype, result) {
    result.description = "Configuration change";

    if (bytes.length < 10) {
        result.error = "AP2 payload too short (need >= 10 bytes, got " + bytes.length + ")";
        return;
    }

    result.channel           = bytes[1];
    result.serial_number     = readUint32LE(bytes, 2);
    result.serial_number_hex = padHex(result.serial_number, 8);
    result.manufacturer      = bytesToHex(bytes.slice(6, 8));
    result.fabrication_block = bytes[8];
    result.medium            = bytes[9];
}


// ─────────────────────────────────────────────────────────────────────
//  Value decoding based on subtype (for SP0-SP8, SP12, SP13)
//
//  Subtype definitions (from section 3.11):
//    0x00 — BCD coded integer (no decimal point)
//    0x01 — Binary coded, unit scale (HCA)
//    0x02 — Binary coded, product scale (HCA)
//    0x03 — Split: high 2 bytes channel[n], low 2 bytes channel[n+1]
//    0x04 — Bucket (T&H sensor)
//    0x05 — Channel 1 binary, channel 2 timestamp
//
//  All values: 0xFF in every byte → value not available (null)
// ─────────────────────────────────────────────────────────────────────

function decodeValue(bytes, offset, length, subtype) {
    // Check for "unknown" marker: all bytes = 0xFF
    var allFF = true;
    for (var i = 0; i < length; i++) {
        if (bytes[offset + i] !== 0xFF) {
            allFF = false;
            break;
        }
    }
    if (allFF) {
        return null; // Value not available / unknown
    }

    switch (subtype) {
        case 0x00: // BCD coded integer
            return decodeBCDValue(bytes, offset, length);

        case 0x01: // Binary coded, unit scale (HCA)
        case 0x02: // Binary coded, product scale (HCA)
            return readUintLE(bytes, offset, length);

        case 0x03:
            // Split: high 2 bytes = channel[n], low 2 bytes = channel[n+1]
            // With LSB byte order: bytes at offset+0..+1 are the "lower" word
            return {
                channel_n:         readUint16LE(bytes, offset + 2),
                channel_n_plus_1:  readUint16LE(bytes, offset)
            };

        case 0x04: // Bucket (T&H sensor)
            return readUintLE(bytes, offset, length);

        case 0x05: // Channel 1 binary, channel 2 timestamp
            if (length >= 4) {
                return {
                    channel_1_value:     readUint16LE(bytes, offset),
                    channel_2_timestamp: readUint16LE(bytes, offset + 2)
                };
            }
            return readUintLE(bytes, offset, length);

        default:
            // Fallback: treat as unsigned binary, LSB first
            return readUintLE(bytes, offset, length);
    }
}


// ─────────────────────────────────────────────────────────────────────
//  Date decoding — EN13757-3:2013, Annex A, Type G (2 bytes, CP16)
//
//  Byte 0 (first byte, low address):
//    bits [4:0]  = day   (UI5, 1-31, 0 = every day)
//    bits [7:5]  = year_low (3 bits)
//  Byte 1 (second byte, high address):
//    bits [3:0]  = month (UI4, 1-12, 15 = every month)
//    bits [7:4]  = year_high (4 bits)
//
//  year = (year_high << 3) | year_low  (0-99, map to 2000-2099)
//  0xFFFF = invalid
// ─────────────────────────────────────────────────────────────────────

function decodeDate(bytes, offset) {
    var b0 = bytes[offset];
    var b1 = bytes[offset + 1];

    if (b0 === 0xFF && b1 === 0xFF) {
        return null; // Invalid / unknown
    }

    var day      =  b0       & 0x1F;
    var yearLow  = (b0 >> 5) & 0x07;
    var month    =  b1       & 0x0F;
    var yearHigh = (b1 >> 4) & 0x0F;
    var year     = 2000 + ((yearHigh << 3) | yearLow);

    return {
        year:  year,
        month: month,
        day:   day,
        iso:   year + "-" + padZero(month) + "-" + padZero(day)
    };
}


// ─────────────────────────────────────────────────────────────────────
//  Date+Time decoding — EN13757-3:2013, Annex A, Type F (4 bytes, CP32)
//
//  Byte 0:
//    bits [5:0]  = minute  (UI6, 0-59, 63 = every minute)
//    bit  [6]    = reserved
//    bit  [7]    = IV (0 = valid, 1 = invalid)
//  Byte 1:
//    bits [4:0]  = hour    (UI5, 0-23, 31 = every hour)
//    bits [6:5]  = (unused)
//    bit  [7]    = SU (0 = standard time, 1 = summer time)
//  Byte 2:
//    bits [4:0]  = day     (UI5, 1-31, 0 = every day)
//    bits [7:5]  = year_low (3 bits)
//  Byte 3:
//    bits [3:0]  = month   (UI4, 1-12, 15 = every month)
//    bits [7:4]  = year_high (4 bits)
//
//  year = (year_high << 3) | year_low  (0-99, map to 2000-2099)
// ─────────────────────────────────────────────────────────────────────

function decodeDatetime(bytes, offset) {
    var b0 = bytes[offset];
    var b1 = bytes[offset + 1];
    var b2 = bytes[offset + 2];
    var b3 = bytes[offset + 3];

    if (b0 === 0xFF && b1 === 0xFF && b2 === 0xFF && b3 === 0xFF) {
        return null; // Invalid / unknown
    }

    var minute   =  b0       & 0x3F;
    var invalid  = (b0 >> 7) & 0x01;
    var hour     =  b1       & 0x1F;
    var summer   = (b1 >> 7) & 0x01;
    var day      =  b2       & 0x1F;
    var yearLow  = (b2 >> 5) & 0x07;
    var month    =  b3       & 0x0F;
    var yearHigh = (b3 >> 4) & 0x0F;
    var year     = 2000 + ((yearHigh << 3) | yearLow);

    return {
        year:        year,
        month:       month,
        day:         day,
        hour:        hour,
        minute:      minute,
        summer_time: summer === 1,
        invalid:     invalid === 1,
        iso:         year + "-" + padZero(month) + "-" + padZero(day) +
                     "T" + padZero(hour) + ":" + padZero(minute) + ":00"
    };
}


// ─────────────────────────────────────────────────────────────────────
//  Status summary (2 bytes, device-specific interpretation)
// ─────────────────────────────────────────────────────────────────────

function decodeStatusSummary(bytes, offset) {
    return {
        raw:    "0x" + toHex(bytes[offset + 1]) + toHex(bytes[offset]),
        byte_0: bytes[offset],
        byte_1: bytes[offset + 1]
    };
}


// ─────────────────────────────────────────────────────────────────────
//  Status code name lookup (AP1 — section 4.2.1)
// ─────────────────────────────────────────────────────────────────────

function getStatusCodeName(code) {
    var names = {
        0x01: "tamper",
        0x02: "removal",
        0x03: "leak",
        0x04: "reverse_installation",
        0x05: "battery_warning",
        0x06: "oversized",
        0x07: "undersized",
        0x08: "error",
        0x09: "1F_mode",
        0x0A: "no_consumption",
        0x0B: "burst",
        0x0C: "battery_eol",
        0x0D: "dry",
        0x0E: "frost",
        0x0F: "backflow",
        0x10: "battery_prewarning",
        0x13: "smoke_chamber_pollution_forewarning",
        0x14: "smoke_chamber_pollution_warning",
        0x15: "push_button_failure",
        0x16: "horn_drive_level",
        0x18: "test_alarm_released",
        0x19: "smoke_alarm_released",
        0x1A: "ingress_apertures_obstruction",
        0x1B: "led_failure",
        0x1C: "object_in_surrounding_area",
        0x1D: "status_summary",
        0x1E: "comm_adapter_comm_lost",
        0x1F: "comm_adapter_battery_eol"
    };
    return names[code] || "unknown_0x" + toHex(code);
}


// ─────────────────────────────────────────────────────────────────────
//  BCD helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Decode a BCD-encoded integer value from bytes in LSB-first order.
 * Example: bytes [0x78, 0x56, 0x34, 0x12] → 12345678
 */
function decodeBCDValue(bytes, offset, length) {
    var result = 0;
    for (var i = length - 1; i >= 0; i--) {
        var b = bytes[offset + i];
        var hi = (b >> 4) & 0x0F;
        var lo =  b       & 0x0F;
        if (hi > 9 || lo > 9) {
            return null; // Invalid BCD digit
        }
        result = result * 100 + hi * 10 + lo;
    }
    return result;
}

/**
 * Decode BCD bytes to a string (for serial numbers etc.)
 * Bytes in LSB-first order. Returns a zero-padded string.
 */
function decodeBCD(bytes, offset, length) {
    var str = "";
    for (var i = length - 1; i >= 0; i--) {
        var b = bytes[offset + i];
        str += ((b >> 4) & 0x0F).toString() + (b & 0x0F).toString();
    }
    return str;
}


// ─────────────────────────────────────────────────────────────────────
//  Integer reading helpers (unsigned, little-endian)
// ─────────────────────────────────────────────────────────────────────

function readUint16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes, offset) {
    return (
        bytes[offset]              |
        (bytes[offset + 1] << 8)   |
        (bytes[offset + 2] << 16)  |
        (bytes[offset + 3] << 24)
    ) >>> 0; // >>> 0 ensures unsigned 32-bit result
}

function readUintLE(bytes, offset, length) {
    var val = 0;
    for (var i = length - 1; i >= 0; i--) {
        val = val * 256 + bytes[offset + i];
    }
    return val;
}


// ─────────────────────────────────────────────────────────────────────
//  Formatting helpers
// ─────────────────────────────────────────────────────────────────────

function toHex(val) {
    return ("0" + (val & 0xFF).toString(16).toUpperCase()).slice(-2);
}

function padHex(val, digits) {
    var s = val.toString(16).toUpperCase();
    while (s.length < digits) { s = "0" + s; }
    return s;
}

function padZero(val) {
    return (val < 10 ? "0" : "") + val;
}

function bytesToHex(arr) {
    var hex = "";
    for (var i = 0; i < arr.length; i++) {
        hex += toHex(arr[i]);
    }
    return hex;
}
