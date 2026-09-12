"use client";

import {useFormStatus} from "react-dom";
import {deleteGame} from "@/app/actions/games";

function DeleteSubmit(){
  const {pending}=useFormStatus();
  return (
    <button className="game-delete-button" type="submit" disabled={pending}>
      {pending?"Excluindo…":"🗑️ EXCLUIR JOGO"}
    </button>
  );
}

export function DeleteGameButton({poolId,gameId,label}:{poolId:string;gameId:string;label:string}){
  const action=deleteGame.bind(null,poolId,gameId);
  return (
    <form
      action={action}
      onSubmit={(event)=>{
        if(!window.confirm(`Tem certeza que deseja excluir ${label}? Esta ação não poderá ser desfeita.`)){
          event.preventDefault();
        }
      }}
    >
      <DeleteSubmit/>
    </form>
  );
}
