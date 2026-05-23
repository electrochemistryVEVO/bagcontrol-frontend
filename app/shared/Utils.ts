export function binarySearch<T,V>(arr : T[], target : V,cmp:(a:T,b:V)=>number, start = 0, end = arr.length - 1) {
    let mid = Math.floor((start + end) / 2);

    if (start > end) {
        return -1;
    }

    if (cmp(arr[mid],target) === 0) {
        //return mid;
        if(mid===arr.length-1)return mid;
        else if(cmp(arr[mid+1],target)!==0)return mid;
    } else if (cmp(arr[mid],target)<0) {
        return binarySearch<T,V>(arr, target,cmp, mid + 1, end);
    } else {
        return binarySearch<T,V>(arr, target,cmp, start, mid - 1);
    }
}