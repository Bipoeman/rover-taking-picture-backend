## MQTT Topics
|Topic|Duty|
|-----|----|
|[`/app/reportState`](#topic-appreportstate)|Send Report of image uploads|
|[`/app/command`](#topic-appcommand)|Send Report of team wins|
|[`/app/enableUpload`](#topic-appenableupload)|Enable Upload command|

## Topic `/app/reportState`
```json
{ 
    "url": "http://localhost:3002/image/${fileName}",
    "team": "Red"
}
```

## Topic `/app/command`
```ts
interface submitInterface {
  status: string;
  team: string;
}
```


## Topic `/app/enableUpload`
```json
{
  "enable":false
}
```