/**
 * @description 二进制数据流解析
 */

import { Message } from "./Message";
import { USING_LITTLE_ENDIAN } from "../base/Defines";

type BinaryStreamMessageConstructor = typeof BinaryStreamMessage;
type NumberStreamValueConstructor = typeof NumberStreamValue;
type StringStreamValueConstructor = typeof StringStreamValue;

export function serialize(
    key: string,
    type: BinaryStreamMessageConstructor | NumberStreamValueConstructor | StringStreamValueConstructor
);
export function serialize(
    key: string,
    type: ArrayConstructor,
    arrayType: BinaryStreamMessageConstructor | NumberStreamValueConstructor | StringStreamValueConstructor);
export function serialize(
    key: string,
    type: MapConstructor,
    mapKeyType: NumberConstructor | StringConstructor,
    mapValueType: BinaryStreamMessageConstructor | NumberStreamValueConstructor | StringStreamValueConstructor);
export function serialize(key: string, type, arrTypeOrMapKeyType?, mapValueType?) {
    return function (target, memberName) {
        if (Reflect.getOwnPropertyDescriptor(target, '__serialize__') === undefined) {
            let selfSerializeInfo = {};
            if (Reflect.getPrototypeOf(target)['__serialize__']) {
                // 父类拥有序列化信息,并且自己没有序列化信息,则拷贝父类到当前类中来
                if (Reflect.getOwnPropertyDescriptor(target, '__serialize__') === undefined) {
                    let parentSerializeInfo = Reflect.getPrototypeOf(target)['__serialize__'];
                    let serializeKeyList = Object.keys(parentSerializeInfo);
                    for (let len = serializeKeyList.length, i = 0; i < len; i++) {
                        selfSerializeInfo[serializeKeyList[i]] = parentSerializeInfo[serializeKeyList[i]].slice(0);
                    }
                }
            }
            Reflect.defineProperty(target, '__serialize__', {
                value: selfSerializeInfo,
            });
        }
        if (target['__serialize__'][key]) {
            throw `SerializeKey has already been declared:${key}`;
        }
        target['__serialize__'][key] = [memberName, type, arrTypeOrMapKeyType, mapValueType];
    }
}

/**@description 数据流接口 */
interface IStreamValue {
    data: any;
    read(dataView: DataView, offset: number): number;
    write(dataView: DataView, offset: number): number;
    size(): number;
    littleEndian: boolean;
}

/**@description 数据流基类 */
class StreamValue<T> implements IStreamValue {
    data: T = null;
    read(dataView: DataView, offset: number): number {
        return 0;
    }
    write(dataView: DataView, offset: number): number {
        return 0;
    }
    size() {
        return 0;
    }
    /**@description 网络数据全以大端方式进行处理 */
    get littleEndian() {
        return USING_LITTLE_ENDIAN;
    }
}

/**@description 数值类型 */
class NumberStreamValue extends StreamValue<number>{
    data = 0;
}

/**@description 字符串类型 */
class StringStreamValue extends StreamValue<string>{
    data = "";
}

//ArrayBuffer转字符串
export function ab2str(buffer: ArrayBuffer): Promise<string | ArrayBuffer> {
    return new Promise((resolve) => {
        var b = new Blob([buffer]);
        var r = new FileReader();
        r.readAsText(b, 'utf-8');
        r.onload = () => { resolve(r.result) }
    });
}
//字符串转字符串ArrayBuffer
export function str2ab(str: string): Promise<string | ArrayBuffer> {
    return new Promise((resolve) => {
        var b = new Blob([str], { type: 'text/plain' });
        var r = new FileReader();
        r.readAsArrayBuffer(b);
        r.onload = () => { resolve(r.result) }
    });
}

const Buffer = require('buffer').Buffer;
/**@description 字符串类型 */
export class StringValue extends StringStreamValue {
    size() {
        //先写入数据大小长度
        let byteSize = Uint32Array.BYTES_PER_ELEMENT;
        //加上当前字符串数量长度
        let buffer = new Buffer(this.data);
        byteSize += buffer.length;
        return byteSize;
    }
    read(dataView: DataView, offset: number) {
        //先读取字符串长度
        let length = dataView.getUint32(offset, this.littleEndian);
        let byteOffset = offset + Uint32Array.BYTES_PER_ELEMENT;
        //可变长字符串
        let arr = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
            arr[i] = dataView.getUint8(byteOffset);
            byteOffset += Uint8Array.BYTES_PER_ELEMENT;
        }

        ab2str(arr.buffer).then((data) => {
            this.data = data as string;
        });
        return byteOffset;
    }

    write(dataView: DataView, offset: number) {
        //先写入字符串长度
        let byteOffset = offset;
        let buffer: Uint8Array = new Buffer(this.data);
        let byteLenght = buffer.length;
        //可变长字符串
        dataView.setUint32(byteOffset, byteLenght, this.littleEndian);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;
        //写入字符串内容
        for (let i = 0; i < buffer.length; i++) {
            dataView.setUint8(byteOffset, buffer[i]);
            byteOffset += Uint8Array.BYTES_PER_ELEMENT;
        }
        return byteOffset;
    }
}

/**@description 固定长度 */
export class StringArrayValue extends StringValue {
    dataLength = 0;
}

export class Float32Value extends NumberStreamValue {
    size() {
        return Float32Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getFloat32(offset, this.littleEndian)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setFloat32(offset, this.data, this.littleEndian);
        return this.size();
    }
}

export class Float64Value extends NumberStreamValue {
    size() {
        return Float64Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getFloat64(offset, this.littleEndian)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setFloat64(offset, this.data, this.littleEndian);
        return this.size();
    }
}

export class Int8Value extends NumberStreamValue {
    size() {
        return Int8Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getInt8(offset)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setInt8(offset, this.data);
        return this.size();
    }
}

export class Int16Value extends NumberStreamValue {
    size() {
        return Int16Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getInt16(offset, this.littleEndian)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setInt16(offset, this.data, this.littleEndian);
        return this.size();
    }
}

export class Int32Value extends NumberStreamValue {
    size() {
        return Int32Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getInt32(offset, this.littleEndian)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setInt32(offset, this.data, this.littleEndian);
        return this.size();
    }
}

export class Uint8Value extends NumberStreamValue {
    size() {
        return Uint8Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getUint8(offset)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setUint8(offset, this.data);
        return this.size();
    }
}

export class Uint16Value extends NumberStreamValue {
    size() {
        return Uint16Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getUint16(offset, this.littleEndian)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setUint16(offset, this.data, this.littleEndian);
        return this.size();
    }
}

export class Uint32Value extends NumberStreamValue {
    size() {
        return Uint32Array.BYTES_PER_ELEMENT;
    }
    read(dataView: DataView, offset: number) {
        this.data = dataView.getUint32(offset, this.littleEndian)
        return this.size();
    }

    write(dataView: DataView, offset: number) {
        dataView.setUint32(offset, this.data, this.littleEndian);
        return this.size();
    }
}

class BinaryStream extends Message {

    private _dataView: DataView = null;
    /**@description 读取数据的偏移量 */
    private _byteOffset = 0;

    /**@description 将当前数据转成buffer */
    protected toBuffer() {
        let size = this.size()
        let buffer = new ArrayBuffer(size)
        this._dataView = new DataView(buffer)
        this._byteOffset = 0;
        this.serialize();
        this.buffer = new Uint8Array(this._dataView.buffer);
        return true;
    }

    /**@description 是否是数值类型 */
    private isNumberValue(valueType: any) {
        return valueType == Float32Value || valueType == Float64Value ||
            valueType == Int8Value || valueType == Int16Value || valueType == Int32Value ||
            valueType == Uint8Value || valueType == Uint16Value || valueType == Uint32Value;
    }

    /**@description 是否是字符串类型 */
    private isStringValue(valueType: any) {
        return valueType == StringValue || valueType == StringArrayValue;
    }

    /**@description 计算当前需要序列化的实际大小 */
    protected size(): number {
        let byteSize = 0;
        let __serialize__ = Reflect.getPrototypeOf(this)['__serialize__'];
        if (!__serialize__) return null;
        let serializeKeyList = Object.keys(__serialize__);
        for (let len = serializeKeyList.length, i = 0; i < len; i++) {
            let serializeKey = serializeKeyList[i];
            let [memberName, type, arrTypeOrMapKeyType, mapValueType] = __serialize__[serializeKey];
            let memberSize = this.memberSize(this[memberName], type, arrTypeOrMapKeyType, mapValueType);
            if (null === memberSize) {
                cc.warn("Invalid serialize member size : " + memberName);
            }
            byteSize += memberSize;
        }
        return byteSize;
    }

    /**@description 计算成员变量数据大小 */
    protected memberSize(value: any, valueType: any, arrTypeOrMapKeyType: any, mapValueType: any): number {
        if (this.isNumberValue(valueType)) {
            return this.memberNumberSize(value, valueType);
        } else if (this.isStringValue(valueType)) {
            return this.memberStringSize(value, valueType, arrTypeOrMapKeyType);
        } else if (value instanceof Array) {
            return this.memberArraySize(value, valueType, arrTypeOrMapKeyType, mapValueType);
        } else if (value instanceof Map) {
            return this.memberMapSize(value, valueType, arrTypeOrMapKeyType, mapValueType);
        } else if (value instanceof BinaryStreamMessage) {
            return value.serialize();
        } else {
            cc.warn("Invalid serialize value : " + value);
            return null;
        }
    }

    protected memberNumberSize(value: any, valueType: typeof NumberStreamValue): number {
        let type = new valueType();
        return type.size();
    }

    protected memberStringSize(value: any, valueType: typeof StringStreamValue, size: number): number {
        let type = new valueType();
        type.data = value;
        return type.size();
    }

    private memberArraySize(value: any[], valueType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        //数组的大小
        let typeSize = Uint32Array.BYTES_PER_ELEMENT;
        value.forEach(element => {
            typeSize += this.memberSize(value, valueType, arrTypeOrMapKeyType, mapValueType);
        });
        return typeSize;
    }

    private memberMapSize(value: Map<any, any>, valueType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        //数组大小
        let typeSize = Uint32Array.BYTES_PER_ELEMENT;
        let self = this;
        value.forEach((dataValue, key) => {
            //Key的大小
            typeSize += this.memberSize(key, valueType, arrTypeOrMapKeyType, mapValueType);
            //数据的大小
            typeSize += this.memberSize(dataValue, valueType, arrTypeOrMapKeyType, mapValueType);
        });
        return typeSize;
    }

    /**@description 序列化 */
    private serialize() {
        let __serialize__ = Reflect.getPrototypeOf(this)['__serialize__'];
        if (!__serialize__) return null;
        let serializeKeyList = Object.keys(__serialize__);
        for (let len = serializeKeyList.length, i = 0; i < len; i++) {
            let serializeKey = serializeKeyList[i];
            let [memberName, type, arrTypeOrMapKeyType, mapValueType] = __serialize__[serializeKey];
            let iscomplete = this.serializeMember(this[memberName], type, arrTypeOrMapKeyType, mapValueType);
            if (!iscomplete) {
                cc.warn(`Invaild serialize member : ${memberName}`)
            }
        }
    }

    /**
     * @description 序列化成员变量
     * @param value 该成员变量的值
     * */
    private serializeMember(value: any, valueType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        if (this.isNumberValue(valueType)) {
            this.serializeNumberStreamValue(value, valueType);
        } else if (this.isStringValue(valueType)) {
            this.serializeStringStreamValue(value, valueType, arrTypeOrMapKeyType);
        } else if (value instanceof Array) {
            this.serializeArray(value, valueType, arrTypeOrMapKeyType, mapValueType);
        } else if (value instanceof Map) {
            this.serializeMap(value, valueType, arrTypeOrMapKeyType, mapValueType);
        } else if (value instanceof BinaryStreamMessage) {
            value.serialize();
        } else {
            return false;
        }
        return true;
    }

    private serializeNumberStreamValue(value: number, valueType: typeof NumberStreamValue) {
        let type = new valueType();
        type.data = (value === undefined || value === null || value == Number.NaN) ? 0 : value;
        this._byteOffset += type.write(this._dataView, this._byteOffset);
    }

    private serializeStringStreamValue(value: string, valueType: typeof StringStreamValue, size: number) {
        let type = new valueType();
        type.data = (value === undefined || value === null) ? "" : value;
        this._byteOffset += type.write(this._dataView, this._byteOffset);
    }

    private serializeArray(value: Array<any>, valueType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        //先写入数组的大小
        this._dataView.setUint32(this._byteOffset, value.length, USING_LITTLE_ENDIAN);
        this._byteOffset += Uint32Array.BYTES_PER_ELEMENT;
        value.forEach(element => {
            this.serializeMember(element, valueType, arrTypeOrMapKeyType, mapValueType);
        });
    }

    private serializeMap(value: Map<any, any>, valueType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        let self = this;
        //先写入字典的大小
        this._dataView.setUint32(this._byteOffset, value.size, USING_LITTLE_ENDIAN);
        this._byteOffset += Uint32Array.BYTES_PER_ELEMENT;
        value.forEach((dataValue, dataKey) => {
            //写入key
            if (arrTypeOrMapKeyType instanceof String) {
                let keyValue = new StringValue();
                keyValue.data = dataKey;
                this._byteOffset += keyValue.write(this._dataView, this._byteOffset);
            } else {
                this._dataView.setUint32(this._byteOffset, dataKey, USING_LITTLE_ENDIAN)
                this._byteOffset += Uint32Array.BYTES_PER_ELEMENT;
            }
            //写值
            this.serializeMember(dataValue, valueType, arrTypeOrMapKeyType, mapValueType);
        });
    }

    /**@description 从二进制数据中取数据 */
    decode(data: Uint8Array): boolean {
        this.buffer = data;
        this._dataView = new DataView(data.buffer);
        this._byteOffset = 0;
        return this.deserialize();
    }

    /**
     * @description 从json压缩对象信息 反序列化为实体类字段信息
     * @param data json压缩对象
     * */
    private deserialize() {
        let __serializeInfo = Reflect.getPrototypeOf(this)['__serialize__'];
        if (!__serializeInfo) return true;
        let serializeKeyList = Object.keys(__serializeInfo);
        for (let len = serializeKeyList.length, i = 0; i < len; i++) {
            let serializeKey = serializeKeyList[i];
            let [memberName, type, arrTypeOrMapKeyType, mapValueType] = __serializeInfo[serializeKey];
            let iscomplete = this.deserializeMember(memberName, type, arrTypeOrMapKeyType, mapValueType);
            if (!iscomplete) {
                cc.warn("Invalid deserialize member :" + memberName);
                return false;
            }
        }
        return true;
    }

    /**
     * @description 反序列化成
     * @param memberName 成员变量名
     * @param memberType 成员变量类型
     * @param arrTypeOrMapKeyType 数组值类型/Map的key类型
     * @param mapValueType Map的值类型
     * @param value json压缩对象
     */
    private deserializeMember(memberName: any, memberType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        try {
            let originValue = this[memberName];
            if (this.isNumberValue(memberType)) {
                this[memberName] = this.deserializeNumberStreamValue(memberName, memberType);
            } else if (this.isStringValue(memberType)) {
                this[memberName] = this.deserializeStringStreamValue(memberName, memberType, arrTypeOrMapKeyType);
            } else if (originValue instanceof Array) {
                this.deserializeArray(memberName, memberType, arrTypeOrMapKeyType, mapValueType);
            } else if (originValue instanceof Map) {
                this.deserializeMap(memberName, memberType, arrTypeOrMapKeyType, mapValueType);
            } else if (originValue instanceof BinaryStreamMessage) {
                originValue.deserialize();
            } else {
                return false;
            }
            return true;
        } catch (error) {
            cc.warn(error.message);
            this[memberName] = error.data || null;
            return false;
        }
    }

    private deserializeNumberStreamValue(memberName: any, memberType: typeof NumberStreamValue) {
        let value = new memberType();
        this._byteOffset += value.read(this._dataView, this._byteOffset);
        return value.data;
    }

    private deserializeStringStreamValue(memberName: any, memberType: typeof StringStreamValue, arrTypeOrMapKeyType: number) {
        let value = new memberType();
        this._byteOffset += value.read(this._dataView, this._byteOffset);
    }

    private deserializeArray(memberName: any, memberType: any, arrTypeOrMapKeyType: any, mapValueType: any) {
        //重新解析，初始化时可能已经赋值，需要先清空对象
        this[memberName] = [];
        //先读数组大小
        let size = this._dataView.getUint32(this._byteOffset, USING_LITTLE_ENDIAN);
        this._byteOffset += Uint32Array.BYTES_PER_ELEMENT;
        for (let i = 0; i < size; i++) {
            let type = new memberType();
            if (memberType instanceof BinaryStreamMessage) {
                this[memberName][i] = type.deserialize();
            } else {
                this._byteOffset += type.read(this._dataView, this._byteOffset);
                this[memberName][i] = type.data;
            }
        }
    }

    private deserializeMap(memberName: any, memberType: any, arrTypeOrMapKeyType: any, mapValueType: any) {

        this[memberName] = new Map;
        //先读入数组大小
        let size = this._dataView.getUint32(this._byteOffset, USING_LITTLE_ENDIAN);
        this._byteOffset += Uint32Array.BYTES_PER_ELEMENT;
        for (let i = 0; i < size; i++) {
            let key = null;
            //写入key
            if (arrTypeOrMapKeyType instanceof String) {
                let keyValue = new StringValue();
                this._byteOffset += keyValue.read(this._dataView, this._byteOffset)
                key = keyValue.data;
            } else {
                key = this._dataView.getUint32(this._byteOffset, USING_LITTLE_ENDIAN)
                this._byteOffset += Uint32Array.BYTES_PER_ELEMENT;
            }
            //写值
            let data = new mapValueType();
            if (mapValueType instanceof BinaryStreamMessage) {
                data.deserialize();
            } else {
                this._byteOffset += data.read(this._dataView, this._byteOffset);
                data = data.data;
            }
            this[memberName].set(key, data);
        }
    }
}

export class BinaryStreamMessage extends BinaryStream {
    @serialize("mainCmd", Int32Value)
    mainCmd = 0;
    @serialize("subCmd", Int32Value)
    subCmd = 0;
}