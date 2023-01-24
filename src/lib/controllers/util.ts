import { v4 as uuidv4 } from 'uuid';
import { rightCb, leftCb, topCb, bottomCb } from './anchorCb'; // these are callbacks used to calculate anchor position relative to node
import type {
  NodeType,
  EdgeType,
  AnchorType,
  StoreType,
  ResizeNodeType,
  UserNodeType,
  UserEdgeType,
} from '$lib/models/types';
import { ResizeNode } from '$lib/models/store';
import { Anchor } from '$lib/models/Anchor';
import { Node } from '$lib/models/Node';
import { Edge } from '$lib/models/Edge';
import { writable, derived, get, readable } from 'svelte/store';
import {
  getNodes,
  getAnchors,
  getNodeById,
  getAnchorById,
  getEdgeById,
} from './storeApi';

function createResizeNode(store: StoreType, canvasId: string) {
  const id = uuidv4();
  const resizeNode = new ResizeNode(id, canvasId, -5, -5);
  return resizeNode;
}

function createAnchor(
  store: StoreType,
  userNode: UserNodeType | null,
  sourceOrTarget: 'source' | 'target',
  canvasId: string,
  edgeId: string
) {
  // edge case
  if (userNode === null)
    throw `you cannot create an anchor without a user node (for now)`;

  const anchorId = uuidv4();

  // position is the position on the node where the anchor should be placed
  // specified by the user to be left, right, top, or bottom. If undefine,
  // defaults to bottom
  let position: 'left' | 'right' | 'top' | 'bottom' | undefined;
  if (sourceOrTarget === 'source') position = userNode.sourcePosition;
  else if (sourceOrTarget === 'target') position = userNode.targetPosition;

  // topCb, bottomCb, leftCb, rightCb are callbacks used to set the anchor position relative
  // to its parent node.
  let positionCb: Function;
  if (position === 'top') positionCb = topCb;
  else if (position === 'bottom') positionCb = bottomCb;
  else if (position === 'left') positionCb = leftCb;
  else if (position === 'right') positionCb = rightCb;
  else positionCb = bottomCb;

  // calculate the initial position of the anchor based on the position of the node
  const [xPosition, yPosition] = positionCb(
    userNode.position.x,
    userNode.position.y,
    userNode.width,
    userNode.height
  );

  // wrap positionCB so that Anchor is able to set its own x,y position
  const setStoreCb = () => {
    const node = getNodeById(store, userNode.id);
    const { positionX, positionY, width, height } = node;
    const [x, y] = positionCb(positionX, positionY, width, height);
    const anchor = getAnchorById(store, anchorId);
    anchor.positionX = x;
    anchor.positionY = y;
  };

  // this callback sets anchor position depending on the other node
  const setStoreCb2 = () => {
    // get the two anchors
    const anchors = getAnchors(store, { edgeId: edgeId });
    if (anchors.length !== 2) throw 'there should be two anchors per edge';
    let [anchorSelf, anchorOther] = anchors;
    if (anchorSelf.id !== anchorId)
      [anchorSelf, anchorOther] = [anchorOther, anchorSelf];
    // get the two nodes
    const nodeSelf = getNodeById(store, anchorSelf.nodeId);
    const nodeOther = getNodeById(store, anchorOther.nodeId);
    // get the midpoints
    const [xSelf, ySelf, xOther, yOther] = [
      nodeSelf.positionX + nodeSelf.width / 2,
      nodeSelf.positionY + nodeSelf.height / 2,
      nodeOther.positionX + nodeOther.width / 2,
      nodeOther.positionY + nodeOther.height / 2,
    ];
    // calculate the slope
    const slope = (ySelf - yOther) / (xSelf - xOther);
    // slope<1 means -45 to 45 degrees so left/right anchors
    if (Math.abs(slope) < 1) {
      if (nodeSelf.positionX < nodeOther.positionX) {
        const [selfX, selfY] = rightCb(
          nodeSelf.positionX,
          nodeSelf.positionY,
          nodeSelf.width,
          nodeSelf.height
        );
        const [otherX, otherY] = leftCb(
          nodeOther.positionX,
          nodeOther.positionY,
          nodeOther.width,
          nodeOther.height
        );
        anchorSelf.setPosition(selfX, selfY);
        anchorOther.setPosition(otherX, otherY);
      } else {
        const [selfX, selfY] = leftCb(
          nodeSelf.positionX,
          nodeSelf.positionY,
          nodeSelf.width,
          nodeSelf.height
        );
        const [otherX, otherY] = rightCb(
          nodeOther.positionX,
          nodeOther.positionY,
          nodeOther.width,
          nodeOther.height
        );
        anchorSelf.setPosition(selfX, selfY);
        anchorOther.setPosition(otherX, otherY);
      }
    } else {
      // top/bottom
      if (nodeSelf.positionY < nodeOther.positionY) {
        const [selfX, selfY] = bottomCb(
          nodeSelf.positionX,
          nodeSelf.positionY,
          nodeSelf.width,
          nodeSelf.height
        );
        const [otherX, otherY] = topCb(
          nodeOther.positionX,
          nodeOther.positionY,
          nodeOther.width,
          nodeOther.height
        );
        anchorSelf.setPosition(selfX, selfY);
        anchorOther.setPosition(otherX, otherY);
      } else {
        const [selfX, selfY] = topCb(
          nodeSelf.positionX,
          nodeSelf.positionY,
          nodeSelf.width,
          nodeSelf.height
        );
        const [otherX, otherY] = bottomCb(
          nodeOther.positionX,
          nodeOther.positionY,
          nodeOther.width,
          nodeOther.height
        );
        anchorSelf.setPosition(selfX, selfY);
        anchorOther.setPosition(otherX, otherY);
      }
    }
  };

  // Create a new anchor
  const anchor = new Anchor(
    anchorId,
    userNode.id,
    edgeId,
    sourceOrTarget,
    xPosition,
    yPosition,
    setStoreCb2,
    canvasId
  );
  // return
  return anchor;
}

export function populateEdgesStore(
  store: StoreType,
  edges: UserEdgeType[],
  canvasId: string
) {
  const edgesStore: { [key: string]: EdgeType } = {};
  for (let i = 0; i < edges.length; i++) {
    const userEdge = edges[i];
    //  { id: 'e1-2', source: 1, type: 'straight', target: 2, label: 'e1-2' },
    // source is node.id for the source node
    // target is node.id for the target node
    // We need to get the anchors
    const {
      source: sourceNodeId,
      target: targetNodeId,
      id: edgeId,
      type,
      label,
      labelBgColor,
      labelTextColor,
      edgeColor,
      animate,
      noHandle,
      arrow,
    } = userEdge;

    const anchors = getAnchors(store, { edgeId: edgeId });
    // check that we have two anchors for every edge
    if (anchors.length !== 2) throw 'We should have two anchors for every node';
    // check that we have 1 source anchor and 1 target anchor. Since sourceOrTarget is typed to be either 'source'
    //   or 'target', it suffices to check whether there are two unique elements
    if (new Set(anchors.map((e) => e.sourceOrTarget)).size !== 2)
      throw 'we should have one source and one target anchor';
    // get source and target anchor
    let sourceAnchor, targetAnchor;
    if (anchors[0].sourceOrTarget === 'source') {
      sourceAnchor = anchors[0];
      targetAnchor = anchors[1];
    } else {
      sourceAnchor = anchors[1];
      targetAnchor = anchors[0];
    }

    edgesStore[edgeId] = new Edge(
      edgeId,
      sourceAnchor.positionX,
      sourceAnchor.positionY,
      targetAnchor.positionX,
      targetAnchor.positionY,
      canvasId,
      label,
      type,
      labelBgColor,
      labelTextColor,
      edgeColor,
      animate,
      noHandle,
      arrow
    );
  }
  store.edgesStore.set(edgesStore);
}

function findUserNodeById(
  id: string,
  userNodes: UserNodeType[]
): UserNodeType | null {
  for (let i = 0; i < userNodes.length; i++) {
    const userNode = userNodes[i];
    if (userNode.id === id) return userNode;
  }
  return null;
}

export function populateAnchorsStore(
  store: StoreType,
  nodes: UserNodeType[],
  edges: UserEdgeType[],
  canvasId: string
) {
  // anchorsStore will populated and eventaully synchronized to store.anchorsStore
  const anchorsStore: { [key: string]: AnchorType } = {};
  // iterate through user edges. Note the user never explicitly defines anchors; we calculate anchors
  // from the user edge/node information
  for (let i = 0; i < edges.length; i++) {
    const userEdge = edges[i];
    // find the source and target userNodes. These will be used to create the nodeId foreign key and
    // determine placement of the anchor based on userNode.targetPosition, useNode.sourcePosition
    const { source: sourceNodeId, target: targetNodeId } = userEdge;
    const sourceUserNode = findUserNodeById(sourceNodeId, nodes);
    const targetUserNode = findUserNodeById(targetNodeId, nodes);
    // create source anchor
    const sourceAnchor = createAnchor(
      store,
      sourceUserNode,
      'source',
      canvasId,
      userEdge.id
    );
    // create target anchor
    const targetAnchor = createAnchor(
      store,
      targetUserNode,
      'target',
      canvasId,
      userEdge.id
    );
    // store source and target anchors
    anchorsStore[sourceAnchor.id] = sourceAnchor;
    anchorsStore[targetAnchor.id] = targetAnchor;
  }

  //populates the anchorsStore
  store.anchorsStore.set(anchorsStore);
}

export function populateNodesStore(
  store: StoreType,
  nodes: UserNodeType[],
  canvasId: string
) {
  // this is the nodesStore object. THIS IS NOT THE SAME AS A NODESTORE
  const nodesStore: { [key: string]: NodeType } = {};
  // iterate through user nodes and create node objects
  for (let i = 0; i < nodes.length; i++) {
    const userNode: UserNodeType = nodes[i];
    const nodeId = userNode.id;

    const node = new Node(
      nodeId.toString(),
      userNode.position.x,
      userNode.position.y,
      userNode.width,
      userNode.height,
      userNode.bgColor,
      JSON.stringify(userNode.data),
      canvasId,
      userNode.borderColor,
      userNode.image,
      userNode.src,
      userNode.textColor,
      userNode.borderRadius
    );
    nodesStore[nodeId] = node;
  }
  // This is actually what sets the store
  store.nodesStore.set(nodesStore);
}

export function populateResizeNodeStore(store: StoreType, canvasId: string) {
  const resizeNodeStore: { [key: string]: ResizeNodeType } = {};

  const resizeNode = createResizeNode(store, canvasId);
  // console.log(resizeNode);
  resizeNodeStore[resizeNode.id] = resizeNode;
  // console.log('ResizeNodeStore', resizeNodeStore);
  store.resizeNodesStore.set(resizeNodeStore);
}
