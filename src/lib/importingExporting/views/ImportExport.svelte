<script lang="ts">
  import {
    findStore,
    populateSvelvetStoreFromUserInput,
  } from '../../store/controllers/storeApi';

  export let canvasId: string;

  const store = findStore(canvasId);

  const { nodesStore, edgesStore } = store;

  //rawNodeData is an array with nested object holding all exportable data of nodes
  const rawNodeData: any[] = [];

  //rawEdgeData is an array with nested object of exportable edge data
  const rawEdgeData: any[] = [];

  //The href link for the download icon; initially set to an empty string
  let fileHref = '';

  const getData = () => {
    //invoke setExportableData method on each Node and organize exportable data into array rawNodeData
    for (const key in $nodesStore) {
      rawNodeData.push($nodesStore[key].setExportableData());
    }

    for (const key in $edgesStore) {
      rawEdgeData.push($edgesStore[key].setExportableData());
    }
  };

  const exportNodesAndEdges = () => {
    //combine rawNodeData and rawEdgeData to an object
    const dataToExport = { nodes: rawNodeData, edges: rawEdgeData };

    const makeJSONFile = (data) => {
      const processedData = new Blob([JSON.stringify(data)], {
        type: 'application/json',
      });
      const fileToDownload = window.URL.createObjectURL(processedData);
      return fileToDownload;
    };

    //invoke makeJSONFile function to process raw data to a JSON file with a href link returned
    fileHref = makeJSONFile(dataToExport);
  };

  const uploadStore = () => {
    //selects store-input
    const storeInput = document.getElementById(`store-input-${canvasId}`); // TODO: do this properly without accessing the DOM directly
    //reviver function parses JSON string
    const reviver = (key, value) => {
      //if node object has key of custom, evaluates and allows for custom components to be uploaded
      if (key === 'custom') return eval(value);
      return value;
    };
    //grabs input field val
    const text = storeInput.value;

    //If the input JSON is empty, should not proceed to the next step
    if (text === '') return;

    const newStore = JSON.parse(text, reviver);

    //sets nodes/edges from input
    populateSvelvetStoreFromUserInput(canvasId, newStore.nodes, newStore.edges);
    //resets input val to empty string
    storeInput.value = '';
  };
</script>

<!-- this is for the download button and upload input field -->
<div id="export-import">
  <a
    href={fileHref}
    on:click={() => {
      getData();
      exportNodesAndEdges();
    }}
    id="downloadState-{canvasId}"
    download="svelvet-state.json"
  >
    <svg
      id="dwnldimg"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      fill="#000000"
    >
      <g id="SVGRepo_bgCarrier" stroke-width="0" />
      <g id="SVGRepo_iconCarrier">
        <path d="M0 0h48v48H0z" fill="none" />
        <g id="Shopicon">
          <polygon points="22,4 22,20 14,20 24,30 34,20 26,20 26,4 " />
          <path
            d="M8,44h32c2.206,0,4-1.794,4-4V30h-4v10H8V30H4v10C4,42.206,5.794,44,8,44z"
          />
        </g>
      </g></svg
    >
  </a>
  <input
    type="text"
    id={`store-input-${canvasId}`}
    placeholder="Paste JSON here"
  />
  <button id="store-input-btn" on:click={uploadStore}>Upload</button>
</div>

<style>
  #dwnldimg {
    width: 1.5rem;
    margin-right: 0.1rem;
  }

  #store-input,
  #store-input-btn {
    height: 1.5rem;
    border-radius: 0.3rem;
    font-size: 0.7rem;
    margin: 2px;
  }

  #store-input-btn:hover {
    cursor: pointer;
    background-color: #ff4742;
    color: white;
    box-shadow: 1px 1px 3px 1px rgba(0, 0, 0, 0.2);
  }

  #export-import {
    position: absolute;
    left: 10px;
    bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
</style>
