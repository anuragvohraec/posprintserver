import express from "express";
import { Printer, Image } from "@node-escpos/core";
// install escpos-usb adapter module manually
import USB from "@node-escpos/usb-adapter";
// Select the adapter based on your printer type
import { join } from "path";
import { error, log } from "console";

import cors from "cors";

let app = express();
const port = 3000;

//device ready
const device = new USB();

const deviceReady = new Promise(res=>{
  device.open(async function(err){
    if(err){
      res(false);
    }else{
      res(true);
    }
  });  
});

app.use(cors());
app.use(express.json());

function getTableAlignment(d){
    if(d==="c"){
        return "CENTER";
    }else if(d==="r"){
        return "RIGHT";
    }else{
        return "LEFT";
    }
}

function getAlignment(d){
    if(d==="c"){
        return "ct";
    }else if(d==="r"){
        return "rt";
    }else{
        return "lt";
    }
}

app.post('/print', async(req, res) => {
    try{
        if(await deviceReady){
            /**
             * @type {PrintDocument}
             */
            const document = req.body;
    
            const printer = new Printer(device, {encoding:document.encoding,width:document.paper_width});
    
            for(let cmd of document.commands){
                switch(cmd.command){
                    case "align":{
                        printer.align(getAlignment(cmd.data));
                    }break;
                    case "style":{
                        /**
                         * @type {PrintStyle}
                         */
                        let d = cmd.data;
                        let typ = d.type==="n"?"normal":d.type;
                        printer.style(typ);
    
                        let size=1;
                        if(d.size){
                            size=d.size;
                        }
                        printer.size(size,size);
                    }break;
                    case "text":{
                        printer.text(cmd.data);
                    }break;
                    case "newLine":{
                        printer.newLine(cmd.data);
                    }break;
                    case "barcode":{
                        printer.barcode(cmd.data,"EAN13",{ width: 200, height: 100 ,position:"BTH"});
                    }break;
                    case "qrcode":{
                        printer.qrcode(cmd.data);
                    }break;
                    case "table":{
                        /**
                         * @type {PrintTableData}
                         */
                        let data = cmd.data;
                        let colspanTotal = data.colspans.reduce((p,c)=>p+c,0);
                        let c=0;
                        let row=[];
                        for(let h of data.headers){
                            row.push({ text: h, align: getTableAlignment(data.alignments[c]), width:  data.colspans[c]/colspanTotal});
                            c++;
                        }
                        printer.tableCustom(row);
                        printer.drawLine("_");
                        for(let r of data.rows){
                            let row=[];
                            let c=0;
                            for(let k in r){
                                row.push({ text: r[k], align: getTableAlignment(data.alignments[c]), width:  data.colspans[c]/colspanTotal});
                                c++;
                            }
                            printer.tableCustom(row);
                        }
                        printer.drawLine("_");
    
                    }break;
                }
            }
            printer.cut();
            await printer.flush();
            res.sendStatus(200);
        }else{
            //if device not ready : send error message
            res.sendStatus(503);
        }
    }catch(e){
        console.error(e);
        res.sendStatus(400);
    }
})

app.listen(port, () => {
  console.log(`Printer server started ${port}`)
})



/**
 * @typedef PrintCommand
 * @property {"style"|"align"|"text"|"table"|"barcode"|"newLine"|"qrcode"} command
 * @property {any} data
 */

/**
 * @typedef PrintDocument
 * @property {string} encoding
 * @property {number} paper_width
 * @property {PrintCommand[]} commands
 */

/**
 * @typedef PrintStyle
 * @property {"b"|"u"|"n"} type
 * @property {number} size
 */

/**
 * @typedef PrintTableData
 * @property {number[]} colspans
 * @property {string[]} alignments
 * @property {string[]} headers
 * @property {Record<string,string>[]} rows
 */