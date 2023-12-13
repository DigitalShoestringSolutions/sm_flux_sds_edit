import React, { useState, useEffect } from "react";
import { InfluxDB, Point, HttpError } from "@influxdata/influxdb-client";
import {DeleteAPI,  nanoTime } from '@influxdata/influxdb-client-apis'
import { ResponsiveLine } from "@nivo/line";
import 'bootstrap/dist/css/bootstrap.css';
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Pagination from 'react-bootstrap/Pagination'
import Table from 'react-bootstrap/Table'
import Carousel from 'react-bootstrap/Carousel'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import Card from 'react-bootstrap/Card'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Container from 'react-bootstrap/Container'
import { MQTTProvider, useMQTTControl, useMQTTDispatch, useMQTTState } from './MQTTContext'
import APIBackend from './RestAPI'
import './app.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { custom_new_message_action, CustomReducer } from './custom_mqtt';
import { Alert, Badge, Form, InputGroup } from 'react-bootstrap';
import DatePicker from "react-datepicker";
import 'react-datepicker/dist/react-datepicker.css';


function App() {
  let [token, setToken] = React.useState("")
  let [org, setOrg] = React.useState("")
  let [bucket, setBucket] = React.useState("")
  let [url, setUrl] = React.useState("")
  let [startDate, setStartDate] = React.useState(new Date())
  let [endDate, setEndDate] = React.useState(new Date())
  let [query, setQuery] = React.useState("")
  let [results, setResults] = React.useState([])

  let [modResults, setModResults] = React.useState([{}])
  let [newDate, setNewDate] = React.useState(new Date())
  let [newVal, setNewVal] = React.useState("")
  let [index, setIndex] = React.useState(0)

  let [resumbit, setResubmit] = React.useState(false)

  const displayExludeKeys = ['_start', '_stop', 'table', 'result']
  const influxDB = new InfluxDB({url, token})



  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = (index) => {
    setNewDate(new Date(results[index]['_time']))
    setNewVal(results[index]['_value'])
    setIndex(index);
    setShow(true);
  };

  const saveChanges = () => {
    updateResult(index, '_time', newDate.toISOString())
    updateResult(index, '_value', newVal)
    handleClose()
    onModify(index)
  }

  
  React.useEffect(() => {
    console.log("resultsstate", results);
  }, [results]);

  React.useEffect(() => {
    console.log("*** Refresh Query ***");
    if (resumbit){
      onQuerySubmit()
      setResubmit(false)
    }
  }, [resumbit]);


  const onQuerySubmit = () => {

    console.log('*** SUBMIT QUERY ***')


    let startString = startDate.toISOString()
    let endString = endDate.toISOString()
    
    let query = `from(bucket: "${bucket}") |> range(start: ${startString}, stop: ${endString})`
    console.log("query: ", query)

    let res = [];
    const influxQuery = async () => {
      const queryApi = await new InfluxDB({ url, token }).getQueryApi(org);
      await queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          res.push(o);
        },
        complete() {
          console.log("Query Results (API)", res)
          setResults(res)
        },
        error(error) {
          console.log("query failed- ", error);
        }
      });
    };
    influxQuery();
  }



  async function deletePoint(timestamp,value) {

    console.log('*** DELETE DATA ***')

    const deleteAPI = new DeleteAPI(influxDB)
    const exactTimeMs = new Date(timestamp).getTime() 
    const start = new Date(exactTimeMs-10) 
    const stop = new Date(exactTimeMs+10) 
    

    console.log('start: ', start)
    console.log('stop: ', stop)
    console.log('value: ', value)
    console.log('value type: ', typeof value)

    // _value is not permitted in predicate
    
    await deleteAPI.postDelete({
      org,
      bucket,
      body: {
        start: start.toISOString(),
        stop: stop.toISOString(),
        // see https://docs.influxdata.com/influxdb/latest/reference/syntax/delete-predicate/
        predicate: 'machine_name="'+value+'"',
      },
    })

    setResubmit(true)
    handleClose()
    console.log('*** FINISHED DELETE ***')


  }


  const onAutoFill = () => {
    setToken("l3Z9k31lKzZ-Ixupk_s3FjinRas-HHbvf7tsBTpEUCP7m5YQL0Z0jF1yjQEC_ZNYLEr6xkSZfuXMUP_spHe9cg==")
    setOrg("SHOESTRING")
    setBucket("stoppage_monitoring")
    setUrl("http://localhost:8086")
  }


  const onDelete = () => {
    
    console.log("delete pressed")

    console.log("results: ", results[index])
    
    deletePoint(results[index]['_time'], results[index]['machine_name'])  // Should find a way to make solution agnostic
      .then(() => console.log('\nFinished SUCCESS'))
      .catch((error) => {
        console.error(error)
        console.log('\nFinished ERROR')
  })

  }

  const onModify = (index) => {
  /// when modify pressed, use the key to select the right value from the results array and send to API
    console.log("modify pressed")
    console.log("results: ", results[index])


    console.log('*** WRITE POINTS ***')
    console.log('url: ', url)
    console.log('token: ', token)
    console.log('org: ', org)
    console.log('bucket: ', bucket)


    const writeApi = influxDB.getWriteApi(org, bucket, 'ms')

    // Delete items if time has changed
    // Add headings
    let result = results[index]

    let point = new Point(result['_measurement'])
    point.stringField(result['_field'], result['_value'])

    for (const [key, value] of Object.entries(result)) {
      console.log(`${key}: ${value}`, typeof value);
      
      if (key == "_field" || key == "_measurement" || key == "_start" || key == "_stop" || key == "_value" || key == "result" || key == "table"){
        continue
      }
      else if ( key == "_time"){
        point.timestamp(new Date(value))
      }
      else if (typeof value === 'string') {
        point.tag(key, value)
        console.log("string", value)
      }
    }
    console.log("point: ", point)
    writeApi.writePoint(point) 

    writeApi
      .close()
      .then(() => {
        console.log('FINISHED')
      })
      .catch(e => {
        console.error(e)
        console.log('\\nFinished ERROR')
      })
  }

  const updateResult = (index, key, value) => {
    console.log("value: ", value)
    console.log("results[index][key]: ", results[index][key])
    const newResults = [...results];
    newResults[index][key] = value;
    setResults(newResults);
  }


  return (
    <div>
      <Card className='my-2'>
      <Card.Header><h4> Database Details Test: </h4></Card.Header>
      <Card.Body>
        <Form noValidate validated={true}>
          <InputGroup className="mb-3">
            <InputGroup.Text style={{ width: "10em" }}><i className='bi bi-circle-square me-1' />Token</InputGroup.Text>
            <Form.Control
              placeholder="Token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              isValid={!!token}
            />
            <InputGroup.Text style={{ width: "10em" }}><i className='bi bi-circle-square me-1' />Bucket</InputGroup.Text>
            <Form.Control
              placeholder="Bucket"
              value={bucket}
              onChange={(event) => setBucket(event.target.value)}
              required
              isValid={!!bucket}
            />
            <InputGroup.Text style={{ width: "10em" }}><i className='bi bi-circle-square me-1' />Url</InputGroup.Text>
            <Form.Control
              placeholder="Url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              isValid={!!url}
            />
            <InputGroup.Text style={{ width: "10em" }}><i className='bi bi-circle-square me-1' />ORG</InputGroup.Text>
            <Form.Control
              placeholder="ORG"
              value={org}
              onChange={(event) => setOrg(event.target.value)}
              required
              isValid={!!org}
            />
          </InputGroup>

          <div>
            <DatePicker
              showTimeSelect
              minTime={new Date(0, 0, 0, 0, 0)}
              maxTime={new Date(0, 0, 0, 23, 30)}
              selected={startDate}
              onChange={startDate => setStartDate(startDate)}
              dateFormat="MMMM d, yyyy h:mmaa"
            />
            <DatePicker
              showTimeSelect
              minTime={new Date(0, 0, 0, 0, 0)}
              maxTime={new Date(0, 0, 0, 23, 30)}
              selected={endDate}
              onChange={endDate => setEndDate(endDate)}
              dateFormat="MMMM d, yyyy h:mmaa"
            />
          </div>

          
          
          <Button className='float-end' onClick={onQuerySubmit}>Submit</Button>
          <Button className='float-end' onClick={onAutoFill}>Autofill</Button>




        </Form>
      </Card.Body>
    </Card>
    <Card className='my-2'>
      <Card.Header><h4> Query Results: </h4></Card.Header>
        <Card.Body>
        
        {/* <p>{JSON.stringify(results)}</p> */}
        <p> Showing {results.length} result{results.length==1 ? '': "s"} </p>


        <InputGroup className="mb-3">
          
        {results[0] ? <InputGroup.Text style={{ width: "5em", background:"DarkGrey", color:"White" }}><i className='bi me-1' />Index</InputGroup.Text> : null}

          {results[0] ? Object.keys(results[0]).map((key, _) => (
            !displayExludeKeys.includes(key) ? 
            <InputGroup.Text style={{ width: "10em",background:"DarkGrey", color:"White"  }}><i className='bi me-1' />{key}</InputGroup.Text> : null
          ))
          : null}
       </InputGroup>

        
        {results.map((item, index) => (
          <div>
            <InputGroup className="mb-3">
            <InputGroup.Text style={{ width: "5em" }}><i className='bi me-1' />{index}</InputGroup.Text>
            {Object.keys(item).map((key, _) => (
              !displayExludeKeys.includes(key) ? 
              <InputGroup.Text style={{ width: "10em" }}><i className='bi me-1' />{item[key]}</InputGroup.Text>
              : null
            ))}
            
            <Button  variant="outline-secondary" id="button-addon1" onClick={() => handleShow(index)}>Modify</Button>

          </InputGroup>
          

          </div>
        ))
        }
        {/* {results.map((item, index) => (
          <div>
            <InputGroup className="mb-3">
            {Object.keys(item).map((key, _) => (
              
              <Form.Control
                placeholder={item[key]}
                onChange={(event) => updateResult(index, key, event.target.value)}

              />
            ))}
            
          <Button  variant="outline-secondary" id="button-addon1" onClick={() => onModify(index)}>Modify</Button>

          </InputGroup>
          

          </div>
        ))
        } */}
        

  

        </Card.Body>
    </Card>
    <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Editing Item {index}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          
          <InputGroup className="mb-3">
            <InputGroup.Text style={{ width: "10em" }}><i className='bi bi-circle-square me-1' />_value</InputGroup.Text>
            <Form.Control
              placeholder={newVal}
              value={newVal}
              onChange={(event) => setNewVal(event.target.value)}
            />
          </InputGroup>
          <DatePicker
              showTimeSelect
              minTime={new Date(0, 0, 0, 0, 0)}
              maxTime={new Date(0, 0, 0, 23, 30)}
              selected={newDate}
              onChange={newDate => setNewDate(newDate)}
              dateFormat="MMMM d, yyyy h:mmaa"
            />
          
          

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <Button variant="primary" onClick={saveChanges}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
  </div>
  
   
  );
}

export default App;

