import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { SvgDocument } from '../domain/SvgDocument.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';
import { GroupShape } from '../domain/GroupShape.js';
import { NumberValue } from '../domain/NumberValue.js';
import type { Shape } from '../domain/Shape.js';
import type { ReadResult } from '../application/DocumentStore.js';
import { SvgTransform } from './SvgTransform.js';

export class SvgCodec {
  private readonly namespace = 'http://www.w3.org/2000/svg';
  constructor(private readonly factory = new ShapeFactory()) {}

  decode(source: string): ReadResult {
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(source)) throw new Error('SVG DTD and entities are not supported');
    const diagnostics: string[] = [];
    const parser = new DOMParser({ errorHandler: {
      warning: message => diagnostics.push(message), error: message => diagnostics.push(message),
      fatalError: message => diagnostics.push(message),
    } });
    const xml = parser.parseFromString(source, 'image/svg+xml');
    if (diagnostics.length || !xml?.documentElement) throw new Error('invalid SVG XML');
    const root = xml.documentElement;
    if (root.localName !== 'svg' || (root.namespaceURI && root.namespaceURI !== this.namespace)) throw new Error('expected SVG root element');
    for (let node = xml.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 1 && node !== root) throw new Error('multiple SVG root elements');
      if (node.nodeType === 3 && node.nodeValue?.trim()) throw new Error('unexpected text outside SVG root');
    }
    const rootAttrs = this.attributes(root);
    const viewBox = rootAttrs.viewBox?.trim().split(/[\s,]+/u).map(value => NumberValue.parse(value, 'viewBox'));
    if (viewBox && (viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0)) throw new Error('unsupported SVG viewBox');
    const width = NumberValue.positive((rootAttrs.width ?? String(viewBox?.[2] ?? 800)).replace(/px$/u, ''), 'canvas width');
    const height = NumberValue.positive((rootAttrs.height ?? String(viewBox?.[3] ?? 600)).replace(/px$/u, ''), 'canvas height');
    if (viewBox && (viewBox[2] !== width || viewBox[3] !== height)) throw new Error('viewBox must match canvas dimensions');
    const document = new SvgDocument(width, height);
    for (const [key, value] of Object.entries(rootAttrs)) {
      if (['xmlns', 'width', 'height', 'viewBox', 'transform'].includes(key)) continue;
      document.importRootAttribute(key, value);
    }

    // Reserve every explicit ID first: an unnamed rect before rect1 must become rect2.
    const used = new Set<string>();
    for (const element of this.elements(root)) {
      const id = element.getAttribute('id');
      if (id) {
        if (used.has(id)) throw new Error(`id already exists: ${id}`);
        used.add(id);
      }
    }
    const warnings: string[] = [];
    const counters = new Map<string, number>();
    const transform = SvgTransform.parse(rootAttrs.transform);
    const strokeWidth = rootAttrs['stroke-width'] ?? '1';
    const fontSize = rootAttrs['font-size'] ?? '16';
    for (const element of this.elementChildren(root)) {
      document.add(this.readShape(element, used, counters, warnings, transform, strokeWidth, fontSize));
    }
    return { document, warnings };
  }

  private attributes(element: Element): Record<string, string> {
    const result: Record<string, string> = Object.create(null) as Record<string, string>;
    for (let index = 0; index < element.attributes.length; index++) {
      const attr = element.attributes.item(index)!; result[attr.name] = attr.value;
    }
    return result;
  }
  private elementChildren(element: Element): Element[] {
    const result: Element[] = [];
    for (let node = element.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 1) result.push(node as Element);
      else if (![3, 4, 8].includes(node.nodeType)) throw new Error('unsupported SVG XML node');
      else if ((node.nodeType === 3 || node.nodeType === 4) && node.nodeValue?.trim()) throw new Error('unexpected text in SVG container');
    }
    return result;
  }
  private elements(root: Element): Element[] {
    const result: Element[] = [];
    const pending: Element[] = [];
    for (let node = root.firstChild; node; node = node.nextSibling) if (node.nodeType === 1) pending.push(node as Element);
    while (pending.length) {
      const element = pending.pop()!; result.push(element);
      for (let node = element.firstChild; node; node = node.nextSibling) if (node.nodeType === 1) pending.push(node as Element);
    }
    return result;
  }
  private readShape(element: Element, used: Set<string>, counters: Map<string, number>, warnings: string[],
    inherited: SvgTransform, inheritedStrokeWidth: string, inheritedFontSize: string): Shape {
    if (element.namespaceURI && element.namespaceURI !== this.namespace) throw new Error('unsupported SVG namespace');
    const attrs = this.attributes(element);
    const type = element.localName;
    let id = attrs.id;
    if (!id) {
      let counter = counters.get(type) ?? 0;
      do { id = `${type}${++counter}`; } while (used.has(id));
      counters.set(type, counter); used.add(id);
      warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
    }
    const shape = this.factory.fromSvg(type, id, attrs, element.textContent ?? '');
    const transform = inherited.compose(SvgTransform.parse(attrs.transform));
    const strokeWidth = attrs['stroke-width'] ?? inheritedStrokeWidth;
    const fontSize = attrs['font-size'] ?? inheritedFontSize;
    if (shape instanceof GroupShape) {
      for (const child of this.elementChildren(element)) shape.add(this.readShape(child, used, counters, warnings, transform, strokeWidth, fontSize));
    } else {
      for (let node = element.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 1 || (![3, 4, 8].includes(node.nodeType))) throw new Error(`unsupported child of <${type}>`);
        if (shape.textContent === null && node.nodeValue?.trim() && node.nodeType !== 8) throw new Error(`unexpected text in <${type}>`);
      }
      transform.apply(shape, strokeWidth, fontSize);
    }
    return shape;
  }

  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(this.namespace, 'svg', null);
    const root = xml.documentElement;
    root.setAttribute('xmlns', this.namespace);
    root.setAttribute('width', String(document.width)); root.setAttribute('height', String(document.height));
    root.setAttribute('viewBox', `0 0 ${document.width} ${document.height}`);
    for (const [key, value] of Object.entries(document.rootAttributes())) root.setAttribute(key, value);
    for (const shape of document.children) this.writeShape(xml, root, shape, 1);
    if (document.children.length) root.appendChild(xml.createTextNode('\n'));
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(xml) + '\n';
  }
  private writeShape(xml: Document, parent: Element, shape: Shape, depth: number): void {
    parent.appendChild(xml.createTextNode('\n' + '  '.repeat(depth)));
    const element = xml.createElementNS(this.namespace, shape.type);
    element.setAttribute('id', shape.id);
    for (const [key, value] of Object.entries(shape.attributes())) element.setAttribute(key, value);
    if (shape.textContent !== null) element.appendChild(xml.createTextNode(shape.textContent));
    for (const child of shape.children) this.writeShape(xml, element, child, depth + 1);
    if (shape.children.length) element.appendChild(xml.createTextNode('\n' + '  '.repeat(depth)));
    parent.appendChild(element);
  }
}
