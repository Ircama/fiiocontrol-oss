# device drivers

a device driver is a small file that knows how to talk to a specific dac over webhid.

this repo uses a simple driver interface (see `src/libs/devices/fiioJa11.js`). the generic controller (`src/libs/hidController.js`) will:

- show the user a browser picker for any `filters` you provide
- pick the correct driver using `supports(device)`
- route input reports through `parseInputReport(data)`
- call `fetchAllData()`, `syncPreview()`, `sendMasterGain()`, and `saveToDAC()`

## before you start

you'll have to use the official [fiiocontrol.fiio.com](https://fiiocontrol.fiio.com/welcome) website in order to figure out what packets are being sent and recieved from the device for supported actions like changing the master gain and adjusting the eq bands.

to do this, you can add the following code snippet to the browser console before you connect your device to start logging stats into the console, which you can then interpret or provide to an LLM with sufficient documentation to let it decode what the official website's code is trying to do.

```
const originalSend = HIDDevice.prototype.sendReport;
HIDDevice.prototype.sendReport = function(id, data) {
    console.log("[OUT]", id, new Uint8Array(data));
    return originalSend.apply(this, arguments);
};


const originalAdd = HIDDevice.prototype.addEventListener;
HIDDevice.prototype.addEventListener = function(type, listener, options) {
    if (type === "inputreport") {
        const wrapped = function(event) {
            console.log("[IN]", event.reportId, new Uint8Array(event.data.buffer));
            return listener.call(this, event);
        };
        return originalAdd.call(this, type, wrapped, options);
    }
    return originalAdd.call(this, type, listener, options);
};


Object.defineProperty(HIDDevice.prototype, "oninputreport", {
    set(fn) {
        const wrapped = (event) => {
            console.log("[IN]", event.reportId, new Uint8Array(event.data.buffer));
            return fn.call(this, event);
        };
        this.addEventListener("inputreport", wrapped);
    }
});
```

## quick start

1. use fiioJa11.js as a template:

2. implement the functions for your dac

3. register it in:

- `src/libs/devices/index.js`

## driver shape

a driver is a plain object like this:

- `id`: short string id (ex: `"fiio-ja11"`)
- `name`: human readable name
- `filters`: array passed to `navigator.hid.requestDevice({ filters })`
- `defaultBands`: array of bands to show when connected / defaults button
- `supports(device)`: return `true` if this driver should handle the selected device
- `parseInputReport(data)`: parse bytes from `new Uint8Array(e.data.buffer)`
- `fetchAllData(device)`: request current eq/master state from the device
- `sendMasterGain(device, val)`
- `syncPreview(device, bands, masterGain)`
- `saveToDAC(device, bands)`

### parseInputReport return values

return `null` if the packet isn't something you care about.

otherwise return one of:

```js
{ type: "masterGain", value: number }

{ type: "band", index: number, value: { freq: number, gain: number, q: number, type: "PK"|"LSC"|"HSC" } }
```

## tips for contributors

- keep everything device-specific inside the driver file
- try to keep delays (`sleep()`) in the driver, not in the controller
- start by implementing `filters`, `supports()`, and `parseInputReport()` so reading works
- then implement `syncPreview()` so the ui "preview" works
- lastly implement `saveToDAC()`
- please do test out if all the peq functionalities work before submitting a pr :)
